-- SQLite Migration: Create Symbols Table
-- Migration: 002_create_symbols
-- Platform: Desktop (SQLite)
-- Requirements: 12.4 - SQLite migrations in migrations/sqlite/
-- Requirements: 13.5 - SQLite only stores Settings and Config data

-- Symbols table (cache from Cloud)
-- Note: Uses SQLite-specific types (TEXT, INTEGER for boolean)
CREATE TABLE IF NOT EXISTS symbols (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    exchange TEXT NOT NULL,
    
    -- Trading Configuration (stored as TEXT for decimal precision)
    tick_value TEXT NOT NULL,
    min_quantity TEXT NOT NULL,
    max_quantity TEXT NOT NULL,
    price_precision INTEGER NOT NULL,
    quantity_precision INTEGER NOT NULL,
    
    -- Status (INTEGER for boolean: 0/1)
    status TEXT NOT NULL DEFAULT 'pending_review',
    is_streaming INTEGER NOT NULL DEFAULT 0,
    is_processing INTEGER NOT NULL DEFAULT 0,
    enabled_by_admin INTEGER NOT NULL DEFAULT 0,
    
    -- Exchange-Specific Metadata (JSON as TEXT)
    exchange_metadata TEXT,
    
    -- Timestamps (ISO string format)
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_sync_at TEXT NOT NULL,
    delisted_at TEXT,
    
    -- Notes
    notes TEXT,
    
    -- Composite unique constraint
    UNIQUE (symbol, exchange)
);

-- Index for exchange filtering
CREATE INDEX IF NOT EXISTS idx_symbols_exchange ON symbols(exchange);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_symbols_status ON symbols(status);

-- Index for streaming symbols
CREATE INDEX IF NOT EXISTS idx_symbols_is_streaming ON symbols(is_streaming);

-- Index for processing symbols
CREATE INDEX IF NOT EXISTS idx_symbols_is_processing ON symbols(is_processing);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_symbols_exchange_status ON symbols(exchange, status);
