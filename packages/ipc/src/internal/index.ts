/**
 * Internal module exports
 *
 * These are internal implementation classes - NOT for public export.
 * Use factory functions from bootstrap.ts instead.
 *
 * This file is for internal use only within the @flowtrace/ipc package.
 */

// Unix Socket
export { UnixSocketClient, UnixSocketServer } from './unix-socket/index.js';

export type {
  UnixSocketClientConfig,
  UnixSocketServerConfig,
  MessageHandler,
} from './unix-socket/index.js';

// Runtime Database
export {
  RuntimeDatabase,
  RuntimeDatabasePoller,
  MIGRATIONS,
  MIGRATION_001_MESSAGE_QUEUE,
  MIGRATION_002_CANDLE_STATE,
  MIGRATION_003_GAP_RECORDS,
  SCHEMA_VERSION_TABLE,
} from './runtime-database/index.js';

export type {
  RuntimeDatabaseConfig,
  PollerConfig,
  PollerConfigWithoutHandler,
  RuntimeDatabaseInterface,
} from './runtime-database/index.js';
