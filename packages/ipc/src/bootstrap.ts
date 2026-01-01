/**
 * Factory functions for @flowtrace/ipc
 *
 * These factory functions provide the primary API for creating IPC components.
 * Use these instead of directly instantiating internal classes.
 *
 * @module @flowtrace/ipc/bootstrap
 *
 * @example
 * ```typescript
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
 * // Create a runtime database
 * const db = createRuntimeDatabase({ runtimeDbPath: '/data/runtime.db' });
 * db.saveState('BTCUSDT', stateJson);
 *
 * // Create a database poller
 * const poller = createRuntimeDatabasePoller({
 *   database: db,
 *   pollInterval: 1000,
 *   batchSize: 50,
 * });
 * poller.setOnMessage(async (msg) => console.log(msg));
 * await poller.start();
 * ```
 */

import { UnixSocketServer } from './internal/unix-socket/UnixSocketServer.js';
import { UnixSocketClient } from './internal/unix-socket/UnixSocketClient.js';
import { RuntimeDatabase } from './internal/runtime-database/RuntimeDatabase.js';
import { RuntimeDatabasePoller } from './internal/runtime-database/RuntimeDatabasePoller.js';
import type {
  IPCServer,
  IPCClient,
  RuntimeDB,
  RuntimeDBPoller,
  IPCServerConfig,
  IPCClientConfig,
  RuntimeDatabaseConfig,
  RuntimeDatabasePollerConfig,
} from './types.js';

/**
 * Create an IPC server that listens for messages via Unix socket.
 *
 * The server uses a length-prefix protocol for message framing and
 * supports multiple concurrent connections.
 *
 * @param config - Server configuration
 * @returns Configured IPC server instance
 *
 * @example
 * ```typescript
 * const server = createIPCServer({
 *   socketPath: '/tmp/flowtrace.sock',
 *   maxConnections: 100,
 * });
 *
 * server.setMessageHandler(async (msg) => {
 *   console.log('Received:', msg);
 * });
 *
 * await server.start();
 * console.log('Server listening:', server.isListening());
 *
 * // Later...
 * await server.stop();
 * ```
 */
export function createIPCServer(config: IPCServerConfig): IPCServer {
  return new UnixSocketServer(config);
}

/**
 * Create an IPC client that sends messages via Unix socket.
 *
 * The client uses a length-prefix protocol for message framing and
 * provides automatic connection management.
 *
 * @param config - Client configuration
 * @returns Configured IPC client instance
 *
 * @example
 * ```typescript
 * const client = createIPCClient({
 *   socketPath: '/tmp/flowtrace.sock',
 *   connectTimeout: 5000,
 * });
 *
 * await client.connect();
 * console.log('Connected:', client.isConnected());
 *
 * await client.send({
 *   type: 'candle:complete',
 *   payload: candleData,
 * });
 *
 * client.disconnect();
 * ```
 */
export function createIPCClient(config: IPCClientConfig): IPCClient {
  return new UnixSocketClient(config);
}

/**
 * Create a RuntimeDatabase for message queue and state persistence.
 *
 * The database provides:
 * - Message queue: Reliable IPC fallback when Unix Socket is unavailable
 * - Candle state: CandleGroup state persistence for service restarts
 * - Gap records: Gap detection records for admin monitoring
 *
 * @param config - Database configuration
 * @returns Configured RuntimeDatabase instance
 *
 * @example
 * ```typescript
 * const db = createRuntimeDatabase({
 *   runtimeDbPath: '/data/runtime.db',
 *   retentionHours: 24,
 * });
 *
 * // Queue operations
 * db.enqueue({
 *   id: 'msg-1',
 *   type: 'candle:complete',
 *   payload: data,
 *   timestamp: Date.now(),
 * });
 * const messages = db.dequeue(50);
 *
 * // State persistence
 * db.saveState('BTCUSDT', JSON.stringify(candleGroup.toJSON()));
 * const state = db.loadState('BTCUSDT');
 *
 * // Gap records
 * db.saveGap({
 *   symbol: 'BTCUSDT',
 *   fromTradeId: 100,
 *   toTradeId: 105,
 *   gapSize: 5,
 *   detectedAt: Date.now(),
 * });
 *
 * // Cleanup
 * db.close();
 * ```
 */
export function createRuntimeDatabase(
  config: RuntimeDatabaseConfig
): RuntimeDB {
  return new RuntimeDatabase(config);
}

/**
 * Create a RuntimeDatabasePoller that polls queue for messages.
 *
 * The poller runs in the background, periodically checking the database
 * queue for unprocessed messages and invoking the message handler.
 *
 * @param config - Poller configuration
 * @returns Configured RuntimeDatabasePoller instance
 *
 * @example
 * ```typescript
 * const db = createRuntimeDatabase({ runtimeDbPath: '/data/runtime.db' });
 *
 * const poller = createRuntimeDatabasePoller({
 *   database: db,
 *   pollInterval: 1000,  // Poll every second
 *   batchSize: 50,       // Process up to 50 messages per poll
 * });
 *
 * poller.setOnMessage(async (msg) => {
 *   console.log('Processing:', msg);
 *   // Process the message...
 * });
 *
 * await poller.start();
 * console.log('Poller running:', poller.isRunning());
 *
 * // Later...
 * await poller.stop();
 * ```
 */
export function createRuntimeDatabasePoller(
  config: RuntimeDatabasePollerConfig
): RuntimeDBPoller {
  return new RuntimeDatabasePoller(config);
}
