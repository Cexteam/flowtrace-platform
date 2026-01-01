/**
 * SQLite Schema - Barrel Export
 *
 * Exports all SQLite-specific database schemas for Desktop deployment.
 * Uses drizzle-orm/sqlite-core types (sqliteTable, text, integer, etc.)
 *
 *
 * Note: Candles are NOT included here.
 * - Desktop uses Binary (FlatBuffer) storage for candle data
 *
 * Note: Users and AuthSessions are NOT included here.
 * - Auth is Cloud-only, Desktop calls Cloud API
 */

// Exchanges (cache from Cloud)
export {
  exchanges,
  type SqliteExchangeRow,
  type NewSqliteExchangeRow,
} from './exchanges.js';

// Symbols (cache from Cloud)
export {
  symbols,
  type SqliteSymbolRow,
  type NewSqliteSymbolRow,
} from './symbols.js';

// Settings removed - feature not used

// Trade persistence is now handled via @flowtrace/persistence package through IPC.

// Candle persistence is now handled via @flowtrace/persistence package through IPC.
