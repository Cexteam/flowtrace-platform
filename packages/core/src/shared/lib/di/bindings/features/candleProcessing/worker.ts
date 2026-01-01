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
  container
    .bind<IPCStatePersistenceConfig>('IPC_STATE_PERSISTENCE_CONFIG')
    .toConstantValue({
      socketPath,
      connectTimeout: 5000,
      requestTimeout: 10000,
      maxRetries: 5,
      baseRetryDelay: 1000,
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
  container
    .bind<IPCGapPersistenceConfig>('IPC_GAP_PERSISTENCE_CONFIG')
    .toConstantValue({
      socketPath,
      connectTimeout: 5000,
      requestTimeout: 10000,
      maxRetries: 3, // Fewer retries for gap persistence (non-critical)
      baseRetryDelay: 500,
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
  // Default: 30s flush interval, 50 symbols per batch
  container
    .bind<StatePersistenceServiceConfig>('STATE_PERSISTENCE_SERVICE_CONFIG')
    .toConstantValue({
      flushIntervalMs: 30_000, // 30 seconds
      batchSize: 50,
    });

  // Bind StatePersistenceService
  container
    .bind<StatePersistenceService>(
      CANDLE_PROCESSING_TYPES.StatePersistenceService
    )
    .to(StatePersistenceService)
    .inSingletonScope();
}
