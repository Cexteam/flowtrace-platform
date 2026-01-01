/**
 * CandleProcessing Main Thread Bindings
 *
 * Main thread specific bindings for CandleProcessing feature.
 * Main thread role: Aggregate candle data from workers, persist to database
 *
 * Services bound here:
 * - MainThreadCandleStorage: In-memory storage for main thread
 * - HybridEventPublisher: Event publisher (Unix Socket + SQLite Queue)
 *
 * Candle persistence is now handled via StatePersistenceService and IPC.
 *
 */

import { Container } from 'inversify';
import { CANDLE_PROCESSING_TYPES } from './types.js';
import { configureCandleProcessingShared } from './shared.js';

// Application Ports
import { CandleStoragePort } from '../../../../../../features/candleProcessing/application/ports/out/CandleStoragePort.js';
import { EventPublisherPort } from '../../../../../../features/candleProcessing/application/ports/out/EventPublisherPort.js';
import { SymbolConfigPort } from '../../../../../../features/candleProcessing/application/ports/out/SymbolConfigPort.js';

// Shared Adapters (unified implementations)
import { CandleStorage } from '../../../../../../features/candleProcessing/infrastructure/adapters/CandleStorage.js';

// Hybrid Adapters (shared between main and worker threads)
import { HybridEventPublisher } from '../../../../../../features/candleProcessing/infrastructure/adapters/HybridEventPublisher.js';

// Shared Adapters (unified implementations)
import { SymbolConfigAdapter } from '../../../../../../features/candleProcessing/infrastructure/adapters/SymbolConfigAdapter.js';

// IPC infrastructure from @flowtrace/ipc
import { createIPCClient, type IPCClient } from '@flowtrace/ipc';

/**
 * Get socket path from env or default
 */
function getSocketPath(): string {
  return process.env.IPC_SOCKET_PATH || '/tmp/flowtrace.sock';
}

/**
 * Configure CandleProcessing for main thread
 *
 * @param container - InversifyJS container
 */
export function configureCandleProcessingMain(container: Container): void {
  // Bind shared logic first
  configureCandleProcessingShared(container);

  // Unified storage with main thread context
  container
    .bind<string>('CANDLE_STORAGE_CONTEXT')
    .toConstantValue('MainThread');

  container
    .bind<CandleStoragePort>(CANDLE_PROCESSING_TYPES.CandleStoragePort)
    .to(CandleStorage)
    .inSingletonScope();

  // Configure IPC infrastructure
  configureIPCInfrastructure(container);

  // Use HybridEventPublisher for all deployments
  // Provides consistent behavior and zero data loss guarantee
  container
    .bind<EventPublisherPort>(CANDLE_PROCESSING_TYPES.EventPublisherPort)
    .to(HybridEventPublisher)
    .inSingletonScope();

  // Unified symbol config with main thread context
  container.bind<string>('SYMBOL_CONFIG_CONTEXT').toConstantValue('MainThread');

  container
    .bind<SymbolConfigPort>(CANDLE_PROCESSING_TYPES.SymbolConfigPort)
    .to(SymbolConfigAdapter)
    .inSingletonScope();
}

/**
 * Configure IPC infrastructure for external communications
 * Used by HybridEventPublisher for all deployments
 *
 * @param container - InversifyJS container
 */
function configureIPCInfrastructure(container: Container): void {
  const socketPath = getSocketPath();

  // Bind IPCClient using factory function for IPC communications
  container
    .bind<IPCClient>('IPCClient')
    .toDynamicValue(() => {
      return createIPCClient({
        socketPath,
        connectTimeout: 5000,
      });
    })
    .inSingletonScope();
}
