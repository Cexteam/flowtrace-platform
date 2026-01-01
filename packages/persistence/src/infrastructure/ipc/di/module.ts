/**
 * IPC DI Module
 * Infrastructure-centric DI module for IPC infrastructure.
 *
 * Design (Option C):
 * - DI module only binds instances (no wiring logic)
 * - Factory functions create instances (in factories.ts)
 * - Wiring is done in PersistenceApplication.start()
 */

import { Container } from 'inversify';
import type { IPCServer, RuntimeDB, RuntimeDBPoller } from '@flowtrace/ipc';

import { MessageRouter } from '../MessageRouter.js';
import type { PollerConfigValues, MessageHandler } from '../types.js';
import {
  createRuntimeDatabase,
  createUnixSocketServer,
  createRuntimeDatabasePoller,
} from '../factories.js';
import { CandleHandler } from '../../../features/candlePersistence/infrastructure/handlers/CandleHandler.js';
import { STATE_PERSISTENCE_TYPES } from '../../../features/statePersistence/di/types.js';
import { CANDLE_PERSISTENCE_TYPES } from '../../../features/candlePersistence/di/types.js';

// Re-export types from types.ts
export { IPC_TYPES, MESSAGE_ROUTER_TYPES } from './types.js';
import { IPC_TYPES, MESSAGE_ROUTER_TYPES } from './types.js';

// =============================================================================
// Configuration Types
// =============================================================================

export interface IPCConfig {
  socketPath: string;
  runtimeDbPath: string;
  pollInterval?: number;
  batchSize?: number;
}

// =============================================================================
// Binding Registration
// =============================================================================

/**
 * Register all IPC bindings including config, database, handlers, router, and servers.
 * Uses lazy initialization - instances created only when resolved.
 */
export function registerIPCBindings(
  container: Container,
  config: IPCConfig
): void {
  // Config values
  container
    .bind<string>(IPC_TYPES.UnixSocketPath)
    .toConstantValue(config.socketPath);

  container
    .bind<string>(IPC_TYPES.RuntimeDbPath)
    .toConstantValue(config.runtimeDbPath);

  container.bind<PollerConfigValues>(IPC_TYPES.PollerConfig).toConstantValue({
    pollInterval: config.pollInterval ?? 1000,
    batchSize: config.batchSize ?? 50,
  });

  // RuntimeDatabase - created via factory
  container
    .bind<RuntimeDB>(IPC_TYPES.RuntimeDatabase)
    .toDynamicValue((ctx) => {
      const runtimeDbPath = ctx.container.get<string>(IPC_TYPES.RuntimeDbPath);
      return createRuntimeDatabase(runtimeDbPath);
    })
    .inSingletonScope();

  // CandleHandler
  container
    .bind<CandleHandler>(CANDLE_PERSISTENCE_TYPES.CandleHandler)
    .to(CandleHandler)
    .inSingletonScope();

  container
    .bind<MessageHandler>(MESSAGE_ROUTER_TYPES.CandleHandler)
    .toDynamicValue((ctx) =>
      ctx.container.get<CandleHandler>(CANDLE_PERSISTENCE_TYPES.CandleHandler)
    )
    .inSingletonScope();

  // State/Gap handlers for MessageRouter
  container
    .bind<MessageHandler>(MESSAGE_ROUTER_TYPES.StateHandler)
    .toDynamicValue((ctx) =>
      ctx.container.get(STATE_PERSISTENCE_TYPES.StateHandler)
    )
    .inSingletonScope();

  container
    .bind<MessageHandler>(MESSAGE_ROUTER_TYPES.GapHandler)
    .toDynamicValue((ctx) =>
      ctx.container.get(STATE_PERSISTENCE_TYPES.GapHandler)
    )
    .inSingletonScope();

  // MessageRouter
  container
    .bind<MessageRouter>(IPC_TYPES.MessageRouter)
    .to(MessageRouter)
    .inSingletonScope();

  // UnixSocketServer - created via factory (no wiring, done in PersistenceApplication)
  container
    .bind<IPCServer>(IPC_TYPES.UnixSocketServer)
    .toDynamicValue((ctx) => {
      const socketPath = ctx.container.get<string>(IPC_TYPES.UnixSocketPath);
      return createUnixSocketServer(socketPath);
    })
    .inSingletonScope();

  // RuntimeDatabasePoller - created via factory (no wiring, done in PersistenceApplication)
  container
    .bind<RuntimeDBPoller>(IPC_TYPES.RuntimeDatabasePoller)
    .toDynamicValue((ctx) => {
      const pollerConfig = ctx.container.get<PollerConfigValues>(
        IPC_TYPES.PollerConfig
      );
      const runtimeDatabase = ctx.container.get<RuntimeDB>(
        IPC_TYPES.RuntimeDatabase
      );
      return createRuntimeDatabasePoller(
        runtimeDatabase,
        pollerConfig.pollInterval,
        pollerConfig.batchSize
      );
    })
    .inSingletonScope();
}
