/**
 * CandleProcessing Worker Thread Bindings
 *
 * Worker thread specific bindings for CandleProcessing feature.
 * Worker thread role: Process trades, calculate footprints, publish events
 *
 * Services bound here:
 * - WorkerCandleStorage: In-memory storage for worker thread
 * - HybridEventPublisher: Event publisher for worker thread (Unix Socket + SQLite Queue)
 * - WorkerSymbolConfig: Symbol configuration for worker thread
 * - IPCStatePersistenceAdapter: State persistence via IPC
 * - StatePersistenceService: Service for managing state persistence lifecycle
 *
 */

import { Container } from 'inversify';
import { CANDLE_PROCESSING_TYPES } from './types.js';
import { configureCandleProcessingShared } from './shared.js';

// Application Ports
import { CandleStoragePort } from '../../../../../../features/candleProcessing/application/ports/out/CandleStoragePort.js';
import { EventPublisherPort } from '../../../../../../features/candleProcessing/application/ports/out/EventPublisherPort.js';
import { SymbolConfigPort } from '../../../../../../features/candleProcessing/application/ports/out/SymbolConfigPort.js';
import { StatePersistencePort } from '../../../../../../features/candleProcessing/application/ports/out/StatePersistencePort.js';
import { GapPersistencePort } from '../../../../../../features/candleProcessing/application/ports/out/GapPersistencePort.js';

// Application Services
import {
  StatePersistenceService,
  type StatePersistenceServiceConfig,
} from '../../../../../../features/candleProcessing/application/services/StatePersistenceService.js';

// Application Ports (Inbound)
import type { StatePersistenceServicePort } from '../../../../../../features/candleProcessing/application/ports/in/StatePersistenceServicePort.js';

// Application Ports (Outbound)
import type { BinSizeCalculatorPort } from '../../../../../../features/candleProcessing/application/ports/out/BinSizeCalculatorPort.js';

// Infrastructure Adapters
import { BinSizeCalculatorAdapter } from '../../../../../../features/candleProcessing/infrastructure/adapters/BinSizeCalculatorAdapter.js';

// Shared Adapters (unified implementations)
import { CandleStorage } from '../../../../../../features/candleProcessing/infrastructure/adapters/CandleStorage.js';
import { SymbolConfigAdapter } from '../../../../../../features/candleProcessing/infrastructure/adapters/SymbolConfigAdapter.js';

// Hybrid adapter (Unix Socket + SQLite Queue)
import { HybridEventPublisher } from '../../../../../../features/candleProcessing/infrastructure/adapters/HybridEventPublisher.js';

// State persistence adapter
import {
  IPCStatePersistenceAdapter,
  type IPCStatePersistenceConfig,
} from '../../../../../../features/candleProcessing/infrastructure/adapters/IPCStatePersistenceAdapter.js';

// Gap persistence adapter
import {
  IPCGapPersistenceAdapter,
  type IPCGapPersistenceConfig,
} from '../../../../../../features/candleProcessing/infrastructure/adapters/IPCGapPersistenceAdapter.js';

// IPC infrastructure from @flowtrace/ipc
import {
  createIPCClient,
  createRuntimeDatabase,
  type IPCClient,
  type RuntimeDB,
} from '@flowtrace/ipc';
import { workerData } from 'worker_threads';

// Get socketPath from workerData (passed from main thread when spawning worker)
const workerSocketPath = (workerData as { socketPath?: string } | undefined)
  ?.socketPath;

/**
 * IPC Configuration from environment variables with sensible defaults
 */
const IPC_STATE_TIMEOUT_MS = parseInt(
  process.env.IPC_STATE_TIMEOUT_MS ?? '30000',
  10
);
const IPC_GAP_TIMEOUT_MS = parseInt(
  process.env.IPC_GAP_TIMEOUT_MS ?? '15000',
  10
);
const STATE_BATCH_SIZE = parseInt(process.env.STATE_BATCH_SIZE ?? '25', 10);
const STATE_FLUSH_INTERVAL_MS = parseInt(
  process.env.STATE_FLUSH_INTERVAL_MS ?? '30000',
  10
);
const IPC_STATE_MAX_RETRIES = parseInt(
  process.env.IPC_STATE_MAX_RETRIES ?? '3',
  10
);
const IPC_GAP_MAX_RETRIES = parseInt(
  process.env.IPC_GAP_MAX_RETRIES ?? '2',
  10
);

/**
 * Get socket path from workerData, env, or default
 */
function getSocketPath(): string {
  return (
    workerSocketPath || process.env.IPC_SOCKET_PATH || '/tmp/flowtrace.sock'
  );
}

/**
 * Get queue path for SQLite fallback queue
 */
function getQueuePath(): string {
  return '/tmp/flowtrace-queue.db';
}

/**
 * Bind IPC infrastructure (IPCClient and RuntimeDB)
 * Used by HybridEventPublisher for dual-channel delivery
 *
 * @param container - InversifyJS container
 */
function bindIPCInfrastructure(container: Container): void {
  const socketPath = getSocketPath();
  const queuePath = getQueuePath();

  // Bind IPCClient using factory function
  container
    .bind<IPCClient>('IPCClient')
    .toDynamicValue(() => {
      return createIPCClient({
        socketPath,
        connectTimeout: 5000,
      });
    })
    .inSingletonScope();

  // Bind RuntimeDB using factory function
  container
    .bind<RuntimeDB>('RuntimeDB')
    .toDynamicValue(() => {
      return createRuntimeDatabase({
        runtimeDbPath: queuePath,
        retentionHours: 24,
      });
    })
    .inSingletonScope();
}

/**
 * Configure CandleProcessing for worker thread
 *
 * @param container - InversifyJS container
 */
export function configureCandleProcessingWorker(container: Container): void {
  // Bind shared logic first
  configureCandleProcessingShared(container);

  // Unified storage with worker thread context
  container.bind<string>('CANDLE_STORAGE_CONTEXT').toConstantValue('Worker');

  container
    .bind<CandleStoragePort>(CANDLE_PROCESSING_TYPES.CandleStoragePort)
    .to(CandleStorage)
    .inSingletonScope();

  // Bind IPC infrastructure (UnixSocketClient and SQLiteQueue)
  bindIPCInfrastructure(container);

  // Event publisher: HybridEventPublisher
  // Uses Unix Socket as primary channel and SQLite Queue as fallback
  container
    .bind<EventPublisherPort>(CANDLE_PROCESSING_TYPES.EventPublisherPort)
    .to(HybridEventPublisher)
    .inSingletonScope();

  // Unified symbol config with worker thread context
  container.bind<string>('SYMBOL_CONFIG_CONTEXT').toConstantValue('Worker');

  container
    .bind<SymbolConfigPort>(CANDLE_PROCESSING_TYPES.SymbolConfigPort)
    .to(SymbolConfigAdapter)
    .inSingletonScope();

  // Bind StatePersistencePort for state persistence via IPC
  bindStatePersistence(container);

  // Bind GapPersistencePort for gap detection via IPC
  bindGapPersistence(container);

  // Bind StatePersistenceService for managing state persistence lifecycle
  bindStatePersistenceService(container);
}

/**
 * Bind StatePersistencePort with IPCStatePersistenceAdapter
 *
 * @param container - InversifyJS container
 */
function bindStatePersistence(container: Container): void {
  const socketPath = getSocketPath();

  // Bind configuration for IPCStatePersistenceAdapter
  // Uses environment variables with sensible defaults
  container
    .bind<IPCStatePersistenceConfig>('IPC_STATE_PERSISTENCE_CONFIG')
    .toConstantValue({
      socketPath,
      connectTimeout: 5000,
      requestTimeout: IPC_STATE_TIMEOUT_MS, // 30s (was 10s)
      maxRetries: IPC_STATE_MAX_RETRIES, // 3 (was 5)
      baseRetryDelay: 2000, // 2s (was 1s)
      maxRetryDelay: 16000,
    });

  // Bind IPCStatePersistenceAdapter to StatePersistencePort
  container
    .bind<StatePersistencePort>(CANDLE_PROCESSING_TYPES.StatePersistencePort)
    .to(IPCStatePersistenceAdapter)
    .inSingletonScope();
}

/**
 * Bind GapPersistencePort with IPCGapPersistenceAdapter
 *
 * @param container - InversifyJS container
 */
function bindGapPersistence(container: Container): void {
  const socketPath = getSocketPath();

  // Bind configuration for IPCGapPersistenceAdapter
  // Uses environment variables with sensible defaults
  container
    .bind<IPCGapPersistenceConfig>('IPC_GAP_PERSISTENCE_CONFIG')
    .toConstantValue({
      socketPath,
      connectTimeout: 5000,
      requestTimeout: IPC_GAP_TIMEOUT_MS, // 15s (was 10s)
      maxRetries: IPC_GAP_MAX_RETRIES, // 2 (was 3)
      baseRetryDelay: 1000, // 1s (was 500ms)
      maxRetryDelay: 4000,
    });

  // Bind IPCGapPersistenceAdapter to GapPersistencePort
  container
    .bind<GapPersistencePort>(CANDLE_PROCESSING_TYPES.GapPersistencePort)
    .to(IPCGapPersistenceAdapter)
    .inSingletonScope();
}

/**
 * Bind StatePersistenceService for managing state persistence lifecycle
 *
 * @param container - InversifyJS container
 */
function bindStatePersistenceService(container: Container): void {
  // Bind configuration for StatePersistenceService
  // Uses environment variables with sensible defaults
  container
    .bind<StatePersistenceServiceConfig>('STATE_PERSISTENCE_SERVICE_CONFIG')
    .toConstantValue({
      flushIntervalMs: STATE_FLUSH_INTERVAL_MS, // 30s
      batchSize: STATE_BATCH_SIZE, // 25 (was 50)
    });

  // Bind StatePersistenceService
  container
    .bind<StatePersistenceService>(
      CANDLE_PROCESSING_TYPES.StatePersistenceService
    )
    .to(StatePersistenceService)
    .inSingletonScope();

  // Bind StatePersistenceServicePort → StatePersistenceService (Port In binding)
  container
    .bind<StatePersistenceServicePort>(
      CANDLE_PROCESSING_TYPES.StatePersistenceServicePort
    )
    .toDynamicValue((context) =>
      context.container.get<StatePersistenceService>(
        CANDLE_PROCESSING_TYPES.StatePersistenceService
      )
    )
    .inSingletonScope();

  // Bind BinSizeCalculatorPort → BinSizeCalculatorAdapter (Port Out binding)
  container
    .bind<BinSizeCalculatorPort>(CANDLE_PROCESSING_TYPES.BinSizeCalculatorPort)
    .to(BinSizeCalculatorAdapter)
    .inSingletonScope();
}
