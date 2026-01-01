/**
 * RuntimeDatabase schema definitions
 *
 * This schema defines the tables used for runtime state persistence:
 * - message_queue: Persistent message buffering for IPC failover
 * - candle_state: CandleGroup state persistence for service restarts
 * - gap_records: Gap detection records for admin monitoring
 */

/**
 * Migration 001: Message queue table
 */
export const MIGRATION_001_MESSAGE_QUEUE = `
CREATE TABLE IF NOT EXISTS message_queue (
  message_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  processed INTEGER DEFAULT 0,
  processed_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_message_queue_processed 
  ON message_queue(processed, timestamp);

CREATE INDEX IF NOT EXISTS idx_message_queue_cleanup 
  ON message_queue(processed, processed_at);
`;

/**
 * Migration 002: Candle state table
 */
export const MIGRATION_002_CANDLE_STATE = `
CREATE TABLE IF NOT EXISTS candle_state (
  symbol TEXT PRIMARY KEY,
  state_json BLOB NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_candle_state_updated ON candle_state(updated_at);
`;

/**
 * Migration 003: Gap records table
 */
export const MIGRATION_003_GAP_RECORDS = `
CREATE TABLE IF NOT EXISTS gap_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  from_trade_id INTEGER NOT NULL,
  to_trade_id INTEGER NOT NULL,
  gap_size INTEGER NOT NULL,
  detected_at INTEGER NOT NULL,
  synced INTEGER DEFAULT 0,
  synced_at INTEGER,
  UNIQUE(symbol, from_trade_id, to_trade_id)
);

CREATE INDEX IF NOT EXISTS idx_gap_records_symbol ON gap_records(symbol);
CREATE INDEX IF NOT EXISTS idx_gap_records_synced ON gap_records(synced);
CREATE INDEX IF NOT EXISTS idx_gap_records_detected_at ON gap_records(detected_at);
`;

/**
 * Migration 004: Add exchange column to gap_records
 */
export const MIGRATION_004_GAP_RECORDS_EXCHANGE = `
-- Add exchange column with default value for existing records
ALTER TABLE gap_records ADD COLUMN exchange TEXT NOT NULL DEFAULT 'binance';

-- Drop old unique constraint and create new one with exchange
DROP INDEX IF EXISTS idx_gap_records_symbol;
CREATE INDEX IF NOT EXISTS idx_gap_records_exchange_symbol ON gap_records(exchange, symbol);

-- Update unique constraint (SQLite doesn't support ALTER CONSTRAINT, so we recreate)
-- Note: This is handled by the unique index below
CREATE UNIQUE INDEX IF NOT EXISTS idx_gap_records_unique 
  ON gap_records(exchange, symbol, from_trade_id, to_trade_id);
`;

/**
 * Migration 005: Add exchange column to candle_state
 * Changes PRIMARY KEY from (symbol) to (exchange, symbol)
 * SQLite doesn't support ALTER PRIMARY KEY, so we recreate the table
 */
export const MIGRATION_005_CANDLE_STATE_EXCHANGE = `
-- Create new table with exchange column
CREATE TABLE IF NOT EXISTS candle_state_new (
  exchange TEXT NOT NULL DEFAULT 'binance',
  symbol TEXT NOT NULL,
  state_json BLOB NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  PRIMARY KEY (exchange, symbol)
);

-- Copy existing data (assume binance for existing records)
INSERT OR IGNORE INTO candle_state_new (exchange, symbol, state_json, updated_at)
SELECT 'binance', symbol, state_json, updated_at FROM candle_state;

-- Drop old table and rename new one
DROP TABLE IF EXISTS candle_state;
ALTER TABLE candle_state_new RENAME TO candle_state;

-- Recreate index
CREATE INDEX IF NOT EXISTS idx_candle_state_updated ON candle_state(updated_at);
CREATE INDEX IF NOT EXISTS idx_candle_state_exchange ON candle_state(exchange);
`;

/**
 * Schema version table for migration tracking
 */
export const SCHEMA_VERSION_TABLE = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  description TEXT
);
`;

/**
 * All migrations in order
 */
export const MIGRATIONS = [
  {
    version: 1,
    description: 'Message queue table',
    sql: MIGRATION_001_MESSAGE_QUEUE,
  },
  {
    version: 2,
    description: 'Candle state table',
    sql: MIGRATION_002_CANDLE_STATE,
  },
  {
    version: 3,
    description: 'Gap records table',
    sql: MIGRATION_003_GAP_RECORDS,
  },
  {
    version: 4,
    description: 'Add exchange column to gap_records',
    sql: MIGRATION_004_GAP_RECORDS_EXCHANGE,
  },
  {
    version: 5,
    description: 'Add exchange column to candle_state',
    sql: MIGRATION_005_CANDLE_STATE_EXCHANGE,
  },
];
