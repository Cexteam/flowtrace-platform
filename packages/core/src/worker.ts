/**
 * Worker Entry Point
 *
 * Runs in a worker thread and processes trades using the DI container.
 * Handles trade processing, symbol assignment, and state persistence.
 *
 * Message Types:
 * - PROCESS_TRADES: Process batch of trades for a symbol
 * - SYMBOL_ASSIGNMENT: Add/remove symbol assignment
 * - WORKER_INIT: Initialize worker with assigned symbols
 * - WORKER_STATUS: Get worker status
 * - SYNC_METRICS: Get worker metrics for health monitoring
 * - HEARTBEAT: Health check
 * - SHUTDOWN: Graceful shutdown with state flush
 */
import 'reflect-metadata';
import { parentPort, workerData } from 'worker_threads';
import {
  ContainerFactory,
  CANDLE_PROCESSING_TYPES,
} from './shared/lib/di/index.js';
import { CandleProcessingPort } from './features/candleProcessing/application/ports/in/CandleProcessingPort.js';
import { StatePersistenceService } from './features/candleProcessing/application/services/StatePersistenceService.js';
import { createLogger } from './shared/lib/logger/logger.js';
import {
  createTradeData,
  RawTrade,
} from './features/candleProcessing/domain/value-objects/TradeData.js';
import type {
  WorkerMessage,
  WorkerResponse,
} from './features/workerManagement/application/ports/in/WorkerManagementPort.js';

/**
 * Worker ready message sent to main thread
 */
interface WorkerReadyMessage {
  type: 'WORKER_READY';
  workerId: string;
  timestamp: number;
}

const workerId = workerData?.workerId || 'unknown';
const logger = createLogger(`Worker-${workerId}`);

// Create worker thread container
const container = ContainerFactory.createWorkerThread();
logger.info(`Worker ${workerId} initialized`);

const candleProcessing = container.get<CandleProcessingPort>(
  CANDLE_PROCESSING_TYPES.CandleProcessingPort
);

// Get StatePersistenceService for state loading and periodic flush
const statePersistenceService = container.get<StatePersistenceService>(
  CANDLE_PROCESSING_TYPES.StatePersistenceService
);

const startTime = Date.now();

// Track lastTradeIds for gap detection after state loading
let lastTradeIds: Map<string, number> = new Map();

// Track if worker has been initialized with state loading
let isStateLoaded = false;

// Message queue for sequential processing
const messageQueue: WorkerMessage[] = [];
let isProcessing = false;

async function processNextMessage(): Promise<void> {
  if (isProcessing || messageQueue.length === 0) return;

  isProcessing = true;
  const message = messageQueue.shift()!;

  try {
    await handleMessage(message);
  } finally {
    isProcessing = false;
    // Process next message if any
    if (messageQueue.length > 0) {
      setImmediate(() => processNextMessage());
    }
  }
}

parentPort?.on('message', (message: WorkerMessage) => {
  messageQueue.push(message);
  processNextMessage();
});

async function handleMessage(message: WorkerMessage): Promise<void> {
  const msgStart = Date.now();
  try {
    let result: unknown;

    switch (message.type) {
      case 'PROCESS_TRADES':
      case 'PROCESS_TRADES_FULL': {
        const data = message.data as {
          symbol: string;
          trades: RawTrade[];
          config?: { exchange?: string; tickValue?: number };
          options?: { priority?: string; batchId?: string };
        };
        const { symbol, trades, config } = data;

        const completedCandles: unknown[] = [];
        for (const rawTrade of trades) {
          try {
            const trade = createTradeData({ ...rawTrade, s: symbol });
            const res = await candleProcessing.processTrade({
              trade,
              config: {
                symbol,
                exchange: config?.exchange || 'binance',
                tickValue: config?.tickValue || 0.1,
              },
            });
            completedCandles.push(...res.completedCandles);
          } catch (tradeError) {
            // Log error but continue processing other trades
            // This prevents one invalid trade from breaking the entire batch
            logger.warn('Failed to process trade, skipping', {
              symbol,
              tradeId: rawTrade.t,
              error:
                tradeError instanceof Error
                  ? tradeError.message
                  : String(tradeError),
            });
          }
        }
        result = {
          success: true,
          symbol,
          processedTrades: trades.length,
          completedCandles: completedCandles.length,
          processingTimeMs: Date.now() - msgStart,
        };
        break;
      }
      case 'SYMBOL_ASSIGNMENT': {
        const data = message.data as {
          symbol: string;
          tickValue: number;
          exchange: string;
          remove?: boolean;
        };
        const { symbol, tickValue, exchange, remove } = data;
        if (!remove) {
          await candleProcessing.initializeSymbol({
            config: { symbol, exchange, tickValue },
          });
        }
        result = {
          success: true,
          action: remove ? 'removed' : 'added',
          symbol,
        };
        break;
      }
      case 'WORKER_STATUS': {
        result = {
          workerId,
          uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
          memoryUsage: process.memoryUsage(),
        };
        break;
      }
      case 'SYNC_METRICS': {
        // Return current worker metrics for health monitoring
        const mem = process.memoryUsage();
        const cpu = process.cpuUsage();
        result = {
          workerId,
          uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
          memoryUsage: {
            heapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
            heapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
            rssMB: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
            externalMB: Math.round((mem.external / 1024 / 1024) * 100) / 100,
          },
          cpuUsage: {
            userMs: Math.round(cpu.user / 1000), // microseconds to ms
            systemMs: Math.round(cpu.system / 1000),
          },
          status: 'healthy',
          timestamp: new Date(),
        };
        break;
      }
      case 'WORKER_INIT': {
        // Worker initialization with state loading
        const initData = message.data as {
          workerId: string;
          socketPath?: string;
          assignedSymbols?: string[];
        };

        const assignedSymbols = initData.assignedSymbols || [];
        logger.info(
          `Worker ${workerId} received init with ${
            assignedSymbols.length
          } symbols, socketPath: ${initData.socketPath || 'default'}`
        );

        // Load states for assigned symbols BEFORE signaling ready
        // This is BLOCKING - worker won't process trades until states are loaded
        if (assignedSymbols.length > 0 && !isStateLoaded) {
          try {
            logger.info(
              `Loading states for ${assignedSymbols.length} assigned symbols...`
            );
            lastTradeIds = await statePersistenceService.loadStatesForSymbols(
              assignedSymbols
            );
            isStateLoaded = true;
            logger.info(
              `States loaded successfully, ${lastTradeIds.size} symbols have lastTradeId`
            );
          } catch (error) {
            logger.error(`Failed to load states: ${(error as Error).message}`);
            // Continue with empty state - worker will start fresh
            lastTradeIds = new Map();
            isStateLoaded = true;
          }
        }

        // Start periodic flush after state loading
        if (!statePersistenceService.isPeriodicFlushRunning()) {
          statePersistenceService.startPeriodicFlush();
          logger.info('Started periodic flush for dirty states');
        }

        result = {
          success: true,
          workerId,
          initialized: true,
          socketPath: initData.socketPath,
          statesLoaded: lastTradeIds.size,
          assignedSymbols: assignedSymbols.length,
          periodicFlushStarted: true,
        };
        break;
      }
      case 'HEARTBEAT': {
        // Simple heartbeat response
        result = {
          workerId,
          alive: true,
          timestamp: new Date(),
        };
        break;
      }
      case 'SHUTDOWN': {
        // Graceful shutdown handling
        logger.info(
          `Worker ${workerId} received SHUTDOWN signal, flushing all dirty states...`
        );

        try {
          // Flush all dirty states before exit
          await statePersistenceService.flushAll();
          logger.info(
            `Worker ${workerId} flushed all dirty states successfully`
          );

          // Signal FLUSH_COMPLETE to main thread
          parentPort?.postMessage({
            type: 'FLUSH_COMPLETE',
            workerId,
            timestamp: Date.now(),
            success: true,
          });

          result = {
            success: true,
            workerId,
            flushed: true,
          };
        } catch (error) {
          logger.error(
            `Worker ${workerId} failed to flush states on shutdown: ${
              (error as Error).message
            }`
          );

          // Signal FLUSH_COMPLETE with error to main thread
          parentPort?.postMessage({
            type: 'FLUSH_COMPLETE',
            workerId,
            timestamp: Date.now(),
            success: false,
            error: (error as Error).message,
          });

          result = {
            success: false,
            workerId,
            flushed: false,
            error: (error as Error).message,
          };
        }
        break;
      }
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }

    parentPort?.postMessage({
      id: message.id,
      success: true,
      result,
    } as WorkerResponse);
  } catch (error) {
    logger.error(`Worker error: ${(error as Error).message}`);
    parentPort?.postMessage({
      id: message.id,
      success: false,
      error: (error as Error).message,
    } as WorkerResponse);
  }
}

logger.info(
  `Worker ${workerId} initialized with DI container and sequential message queue`
);

// Send WORKER_READY message to main thread after initialization is complete
const workerReadyMessage: WorkerReadyMessage = {
  type: 'WORKER_READY',
  workerId,
  timestamp: Date.now(),
};
parentPort?.postMessage(workerReadyMessage);
logger.info(`Worker ${workerId} sent WORKER_READY signal`);
