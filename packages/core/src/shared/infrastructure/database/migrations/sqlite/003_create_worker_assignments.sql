-- SQLite Migration: Create Worker Assignments Table
-- Migration: 003_create_worker_assignments
-- Platform: Desktop (SQLite)
-- Requirements: 12.4 - SQLite migrations in migrations/sqlite/
-- Requirements: Worker thread management and symbol assignment tracking

-- Worker assignments table
-- Tracks which worker thread is handling which symbol (composite key: exchange:symbol)
CREATE TABLE IF NOT EXISTS worker_assignments (
    -- Composite key: "exchange:symbol"
    symbol_key TEXT PRIMARY KEY,
    
    -- Denormalized for easier queries
    symbol TEXT NOT NULL,
    exchange TEXT NOT NULL,
    
    -- Worker assignment
    worker_id INTEGER NOT NULL,
    
    -- Timestamp (ISO string format)
    assigned_at TEXT NOT NULL
);

-- Index for worker_id lookups
CREATE INDEX IF NOT EXISTS idx_worker_assignments_worker ON worker_assignments(worker_id);

-- Index for exchange filtering
CREATE INDEX IF NOT EXISTS idx_worker_assignments_exchange ON worker_assignments(exchange);

-- Index for symbol filtering
CREATE INDEX IF NOT EXISTS idx_worker_assignments_symbol ON worker_assignments(symbol);

-- Composite index for lookups
CREATE INDEX IF NOT EXISTS idx_worker_assignments_exchange_symbol ON worker_assignments(exchange, symbol);
