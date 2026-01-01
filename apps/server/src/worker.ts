/**
 * Server Worker Entry Point
 *
 * Worker thread that processes trades using the CandleProcessingPort via DI.
 * This is a minimal worker (<100 lines) that delegates all processing to core services.
 *
 * @requirements 9.4 - Maintain all existing functionality from flowtrace project
 */

import 'reflect-metadata';
import { parentPort, workerData } from 'worker_threads';
import {
  ContainerFactory,
  CANDLE_PROCESSING_TYPES,
  createLogger,
  createTradeData,
  type CandleProcessingPort,
  type RawTrade,
} from '@flowtrace/core';

// Worker message types (imported from core)
interface WorkerMessage {
  id: string;
  type: string;
  data?: unknown;
}

interface WorkerResponse {
  id: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

interface WorkerReadyMessage {
  type: 'WORKER_READY';
  workerId: string;
  timestamp: number;
}

const workerId = workerData?.workerId || 'unknown';
const logger = createLogger(`Worker-${workerId}`);

// Create worker thread container using new DI structure
const container = ContainerFactory.createWorkerThread();
logger.info(`Worker ${workerId} initialized`);

const candleProcessing = container.get<CandleProcessingPort>(
  CANDLE_PROCESSING_TYPES.CandleProcessingPort
);
const startTime = Date.now();

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
            userMs: Math.round(cpu.user / 1000),
            systemMs: Math.round(cpu.system / 1000),
          },
          status: 'healthy',
          timestamp: new Date(),
        };
        break;
      }
      case 'WORKER_INIT': {
        const initData = message.data as {
          workerId: string;
          assignedSymbols?: string[];
          mode?: string;
        };
        logger.info(
          `Worker ${workerId} received init with ${
            initData.assignedSymbols?.length || 0
          } symbols`
        );
        result = {
          success: true,
          workerId,
          initialized: true,
        };
        break;
      }
      case 'HEARTBEAT': {
        result = {
          workerId,
          alive: true,
          timestamp: new Date(),
        };
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

// Send WORKER_READY message to main thread
const workerReadyMessage: WorkerReadyMessage = {
  type: 'WORKER_READY',
  workerId,
  timestamp: Date.now(),
};
parentPort?.postMessage(workerReadyMessage);
logger.info(`Worker ${workerId} sent WORKER_READY signal`);
