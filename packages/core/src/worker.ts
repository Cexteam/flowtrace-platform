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
import * as v8 from 'v8';
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

// NEW: Metrics tracking variables for health monitoring
let processingLatencies: number[] = []; // Rolling window of last 100 processing times
let tradesProcessed: Array<{ timestamp: number; count: number }> = []; // Rolling window for throughput

// NEW: Track total processing time for estimated CPU calculation
let totalProcessingTimeMs: number = 0; // Total time spent processing in current window
let lastCpuWindowStart: number = Date.now(); // Start of current CPU measurement window

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
          config?: {
            exchange?: string;
            tickValue?: number;
            binMultiplier?: number | null;
          };
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
                binMultiplier: config?.binMultiplier ?? 1,
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

        // NEW: Track processing metrics for health monitoring
        const processingTime = Date.now() - msgStart;

        // Add to rolling window (keep last 100)
        processingLatencies.push(processingTime);
        if (processingLatencies.length > 100) {
          processingLatencies.shift();
        }

        // Track trades for throughput calculation
        tradesProcessed.push({
          timestamp: Date.now(),
          count: trades.length,
        });

        // Clean old throughput entries (older than 60 seconds)
        const cutoff = Date.now() - 60000;
        tradesProcessed = tradesProcessed.filter(
          (entry) => entry.timestamp > cutoff
        );

        // Track total processing time for estimated CPU
        totalProcessingTimeMs += processingTime;

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
        const v8Heap = v8.getHeapStatistics();
        result = {
          workerId,
          uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
          memoryUsage: {
            heapUsedMB:
              Math.round((v8Heap.used_heap_size / 1024 / 1024) * 100) / 100,
            heapTotalMB:
              Math.round((v8Heap.total_heap_size / 1024 / 1024) * 100) / 100,
          },
        };
        break;
      }
      case 'SYNC_METRICS': {
        // Return current worker metrics for health monitoring
        // Use v8.getHeapStatistics() for per-worker V8 heap memory (each worker has its own V8 isolate)
        const v8Heap = v8.getHeapStatistics();
        const now = Date.now();

        // Calculate estimated CPU based on processing time ratio
        // This gives per-worker CPU estimate based on actual work done
        const windowDuration = now - lastCpuWindowStart;
        let cpuPercent = 0;
        if (windowDuration > 0) {
          // CPU% = (time spent processing / total elapsed time) * 100
          cpuPercent = Math.min(
            100,
            Math.max(0, (totalProcessingTimeMs / windowDuration) * 100)
          );
        }

        // Reset window for next measurement
        totalProcessingTimeMs = 0;
        lastCpuWindowStart = now;

        // Calculate rolling average latency (last 100 batches)
        const avgLatency =
          processingLatencies.length > 0
            ? processingLatencies.reduce((sum, lat) => sum + lat, 0) /
              processingLatencies.length
            : 0;

        // Calculate throughput (trades/second over last 60 seconds)
        const recentTrades = tradesProcessed.filter(
          (entry) => now - entry.timestamp <= 60000
        );
        const totalRecentTrades = recentTrades.reduce(
          (sum, entry) => sum + entry.count,
          0
        );
        const throughput = totalRecentTrades / 60; // trades per second

        // Calculate worker status based on metrics
        let status: 'healthy' | 'warning' | 'critical' | 'unknown' = 'healthy';

        try {
          const queueLength = messageQueue.length;

          // Critical conditions
          if (queueLength > 50 || avgLatency > 5000) {
            status = 'critical';
          }
          // Warning conditions
          else if (queueLength > 10 || avgLatency > 1000 || throughput < 1) {
            status = 'warning';
          }
          // Otherwise healthy
          else {
            status = 'healthy';
          }
        } catch (error) {
          status = 'unknown';
        }

        result = {
          workerId,
          uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
          // Per-worker V8 heap memory (each worker thread has its own V8 isolate)
          memoryUsage: {
            heapUsedMB:
              Math.round((v8Heap.used_heap_size / 1024 / 1024) * 100) / 100,
            heapTotalMB:
              Math.round((v8Heap.total_heap_size / 1024 / 1024) * 100) / 100,
            heapLimitMB:
              Math.round((v8Heap.heap_size_limit / 1024 / 1024) * 100) / 100,
            externalMB:
              Math.round((v8Heap.external_memory / 1024 / 1024) * 100) / 100,
          },
          cpuUsage: {
            // Estimated CPU percentage based on processing time ratio (per-worker)
            percent: Math.round(cpuPercent * 100) / 100,
          },
          // NEW PER-WORKER METRICS
          queueLength: messageQueue.length,
          processingLatencyMs: Math.round(avgLatency * 100) / 100,
          throughputTradesPerSecond: Math.round(throughput * 100) / 100,
          status,
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
