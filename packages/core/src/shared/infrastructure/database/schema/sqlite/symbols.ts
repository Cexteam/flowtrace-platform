/**
 * SQLite Symbols Schema
 *
 * Defines the symbols table for Desktop deployment (cache).
 * Desktop uses this as local cache, syncs from Cloud.
 *
 */

import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core';

/**
 * Symbols Table (SQLite)
 * Local cache of trading symbols from Cloud
 *
 * Note: Uses SQLite-specific types:
 * - text instead of varchar/jsonb
 * - integer instead of boolean (0/1)
 * - text for timestamps (ISO string)
 */
export const symbols = sqliteTable(
  'symbols',
  {
    id: text('id').primaryKey(),
    symbol: text('symbol').notNull(),
    exchange: text('exchange').notNull(),

    // Trading Configuration (stored as text for decimal precision)
    tickValue: text('tick_value').notNull(),
    minQuantity: text('min_quantity').notNull(),
    maxQuantity: text('max_quantity').notNull(),
    pricePrecision: integer('price_precision').notNull(),
    quantityPrecision: integer('quantity_precision').notNull(),

    // Bin multiplier for footprint aggregation (null = auto-calculate)
    binMultiplier: integer('bin_multiplier'),

    // Status
    status: text('status').notNull().default('pending_review'),
    isStreaming: integer('is_streaming', { mode: 'boolean' })
      .notNull()
      .default(false),
    isProcessing: integer('is_processing', { mode: 'boolean' })
      .notNull()
      .default(false),
    enabledByAdmin: integer('enabled_by_admin', { mode: 'boolean' })
      .notNull()
      .default(false),

    // Exchange-Specific Metadata (JSON string in SQLite)
    exchangeMetadata: text('exchange_metadata'),

    // Timestamps (ISO string format)
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    lastSyncAt: text('last_sync_at').notNull(),
    delistedAt: text('delisted_at'),

    // Notes
    notes: text('notes'),
  },
  (table) => ({
    // Composite unique constraint: symbol + exchange
    symbolsSymbolExchangeUnique: unique('symbols_symbol_exchange_unique').on(
      table.symbol,
      table.exchange
    ),
  })
);

// Type exports for TypeScript
export type SqliteSymbolRow = typeof symbols.$inferSelect;
export type NewSqliteSymbolRow = typeof symbols.$inferInsert;
