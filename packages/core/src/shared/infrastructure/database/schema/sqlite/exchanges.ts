/**
 * SQLite Exchange Schema
 *
 * Defines the exchanges table for storing exchange configuration.
 *
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Exchange Table (SQLite)
 * Stores exchange configuration including connection, rate limiting, and sync settings
 */
export const exchanges = sqliteTable('exchanges', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  implementationStatus: text('implementation_status').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),

  // Connection URLs
  wsUrl: text('ws_url').notNull(),
  restUrl: text('rest_url').notNull(),

  // API credentials
  apiKey: text('api_key'),
  apiSecret: text('api_secret'),

  // Rate limiting
  rateLimitPerMinute: integer('rate_limit_per_minute').notNull().default(1200),

  // Reconnection config
  maxReconnectDelay: integer('max_reconnect_delay').notNull().default(60000),
  maxConnectAttempts: integer('max_connect_attempts').notNull().default(300),

  // Sync/Gap recovery config
  syncRestLimit: integer('sync_rest_limit').notNull().default(1000),
  syncCheckIntervalMinutes: integer('sync_check_interval_minutes')
    .notNull()
    .default(5),
  syncMissingThresholdMinutes: integer('sync_missing_threshold_minutes')
    .notNull()
    .default(1),

  // Timestamps
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Type exports for TypeScript
export type SqliteExchangeRow = typeof exchanges.$inferSelect;
export type NewSqliteExchangeRow = typeof exchanges.$inferInsert;
