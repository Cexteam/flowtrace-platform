-- SQLite Migration: Create Exchanges Table
-- Migration: 001_create_exchanges

-- Exchanges table - stores exchange configuration
CREATE TABLE IF NOT EXISTS exchanges (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    implementation_status TEXT NOT NULL DEFAULT 'implemented',
    enabled INTEGER NOT NULL DEFAULT 0,
    
    -- Connection URLs
    ws_url TEXT NOT NULL,
    rest_url TEXT NOT NULL,
    
    -- API credentials
    api_key TEXT,
    api_secret TEXT,
    
    -- Rate limiting
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 1200,
    
    -- Reconnection config
    max_reconnect_delay INTEGER NOT NULL DEFAULT 60000,
    max_connect_attempts INTEGER NOT NULL DEFAULT 300,
    
    -- Sync/Gap recovery config
    sync_rest_limit INTEGER NOT NULL DEFAULT 1000,
    sync_check_interval_minutes INTEGER NOT NULL DEFAULT 5,
    sync_missing_threshold_minutes INTEGER NOT NULL DEFAULT 1,
    
    -- Timestamps
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exchanges_enabled ON exchanges(enabled);
CREATE INDEX IF NOT EXISTS idx_exchanges_implementation_status ON exchanges(implementation_status);

-- Insert initial exchanges with full config
INSERT OR IGNORE INTO exchanges (
    id, display_name, implementation_status, enabled,
    ws_url, rest_url, rate_limit_per_minute,
    max_reconnect_delay, max_connect_attempts,
    sync_rest_limit, sync_check_interval_minutes, sync_missing_threshold_minutes,
    created_at, updated_at
) VALUES
  ('binance', 'Binance', 'implemented', 1,
   'wss://fstream.binance.com/stream', 'https://fapi.binance.com', 1200,
   60000, 300, 1000, 5, 1,
   datetime('now'), datetime('now')),
  ('bybit', 'Bybit', 'not_implemented', 0,
   'wss://stream.bybit.com/v5/public/linear', 'https://api.bybit.com', 600,
   60000, 300, 1000, 5, 1,
   datetime('now'), datetime('now')),
  ('okx', 'OKX', 'not_implemented', 0,
   'wss://ws.okx.com:8443/ws/v5/public', 'https://www.okx.com', 600,
   60000, 300, 100, 5, 1,
   datetime('now'), datetime('now')),
  ('kraken', 'Kraken', 'not_implemented', 0,
   'wss://futures.kraken.com/ws/v1', 'https://futures.kraken.com', 600,
   60000, 300, 1000, 5, 1,
   datetime('now'), datetime('now')),
  ('coinbase', 'Coinbase', 'not_implemented', 0,
   'wss://ws-feed.exchange.coinbase.com', 'https://api.exchange.coinbase.com', 600,
   60000, 300, 1000, 5, 1,
   datetime('now'), datetime('now'));
