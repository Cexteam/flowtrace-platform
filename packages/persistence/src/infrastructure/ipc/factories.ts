/**
 * IPC Factory Functions
 * Creates instances of IPC infrastructure components using factory functions from @flowtrace/ipc.
 * Separated from DI module for better readability and testability.
 */

import {
  createIPCServer,
  createRuntimeDatabase as createRuntimeDB,
  createRuntimeDatabasePoller as createRuntimeDBPoller,
} from '@flowtrace/ipc';
import type { IPCServer, RuntimeDB, RuntimeDBPoller } from '@flowtrace/ipc';

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a RuntimeDatabase instance
 */
export function createRuntimeDatabase(runtimeDbPath: string): RuntimeDB {
  return createRuntimeDB({ runtimeDbPath });
}

/**
 * Create a UnixSocketServer instance (without message handler)
 */
export function createUnixSocketServer(socketPath: string): IPCServer {
  return createIPCServer({ socketPath });
}

/**
 * Create a RuntimeDatabasePoller instance (without message handler)
 */
export function createRuntimeDatabasePoller(
  database: RuntimeDB,
  pollInterval: number,
  batchSize: number
): RuntimeDBPoller {
  return createRuntimeDBPoller({
    database,
    pollInterval,
    batchSize,
  });
}
