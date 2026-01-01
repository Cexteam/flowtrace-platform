/**
 * @module @flowtrace/ipc
 * @description Core IPC infrastructure for FlowTrace platform.
 *
 * This package provides a minimal public API with factory functions for creating
 * IPC components. Internal implementation details are hidden.
 *
 * @example
 * ```typescript
 * // Factory functions (primary API)
 * import {
 *   createIPCServer,
 *   createIPCClient,
 *   createRuntimeDatabase,
 *   createRuntimeDatabasePoller,
 * } from '@flowtrace/ipc';
 *
 * // Create and start an IPC server
 * const server = createIPCServer({ socketPath: '/tmp/app.sock' });
 * server.setMessageHandler(async (msg) => console.log(msg));
 * await server.start();
 *
 * // Create and connect an IPC client
 * const client = createIPCClient({ socketPath: '/tmp/app.sock' });
 * await client.connect();
 * await client.send({ type: 'candle', payload: data });
 *
 * // Type annotations
 * import type { IPCServer, IPCClient, RuntimeDB } from '@flowtrace/ipc';
 *
 * // DTOs and validation
 * import { CandleGroupDTOSchema, validateCandleGroupDTO } from '@flowtrace/ipc';
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Factory Functions (Primary API)
// =============================================================================

export {
  createIPCServer,
  createIPCClient,
  createRuntimeDatabase,
  createRuntimeDatabasePoller,
} from './bootstrap.js';

// =============================================================================
// Public Types (for type annotations)
// =============================================================================

export type {
  // Instance types (interfaces)
  IPCServer,
  IPCClient,
  RuntimeDB,
  RuntimeDBPoller,

  // Config types
  IPCServerConfig,
  IPCClientConfig,
  RuntimeDatabaseConfig,
  RuntimeDatabasePollerConfig,

  // Handler types
  MessageHandler,
  RequestResponseHandler,
  QueueMessageHandler,
} from './types.js';

// =============================================================================
// DTOs and Validation (for IPC message handling)
// =============================================================================

export * from './dto/index.js';
