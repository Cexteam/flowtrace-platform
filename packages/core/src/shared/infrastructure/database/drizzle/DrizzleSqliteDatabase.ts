/**
 * Drizzle SQLite Database Implementation
 *
 * Provides Drizzle ORM instance for SQLite database operations.
 * Used in desktop deployment mode.
 *
 */

import { injectable, inject } from 'inversify';
import {
  drizzle,
  type BetterSQLite3Database,
} from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../schema/sqlite/index.js';
import { DATABASE_SYMBOLS } from '../../../lib/di/bindings/core/database/types.js';
import type { SqliteConfig } from '../config/types.js';
import type { DrizzleDatabase } from './types.js';

/**
 * Drizzle SQLite Database
 *
 * Wraps Drizzle ORM with SQLite adapter for desktop deployment.
 * Manages connection lifecycle and provides type-safe database access.
 */
@injectable()
export class DrizzleSqliteDatabase implements DrizzleDatabase {
  private db: BetterSQLite3Database<typeof schema>;
  private sqlite: Database.Database;

  constructor(
    @inject(DATABASE_SYMBOLS.DatabaseConfig)
    config: {
      type: 'sqlite';
      config: SqliteConfig;
    }
  ) {
    // Create better-sqlite3 connection
    this.sqlite = new Database(config.config.filename, {
      readonly: config.config.readonly || false,
      fileMustExist: config.config.fileMustExist || false,
    });

    // Enable WAL mode for better concurrency if requested
    if (config.config.walMode) {
      this.sqlite.pragma('journal_mode = WAL');
    }

    // Create Drizzle instance with schema
    this.db = drizzle(this.sqlite, { schema });
  }

  /**
   * Get Drizzle ORM instance
   *
   * Returns type-safe SQLite database instance with full schema.
   */
  getDb(): BetterSQLite3Database<typeof schema> {
    return this.db;
  }

  /**
   * Close database connection
   *
   * Closes the SQLite database file.
   */
  close(): void {
    this.sqlite.close();
  }

  /**
   * Test database connection
   *
   * Executes a simple query to verify database connectivity.
   */
  testConnection(): boolean {
    try {
      this.sqlite.prepare('SELECT 1').get();
      return true;
    } catch (error) {
      console.error('SQLite connection test failed:', error);
      return false;
    }
  }
}
