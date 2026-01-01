/**
 * Drizzle Database Interface
 *
 * Interface for SQLite database using Drizzle ORM.
 *
 */

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

/**
 * Drizzle Database Interface
 *
 * Provides access to Drizzle ORM instance for type-safe database operations.
 */
export interface DrizzleDatabase {
  /**
   * Get Drizzle ORM instance
   *
   * Returns a type-safe SQLite database instance with schema.
   */
  getDb(): BetterSQLite3Database<any>;

  /**
   * Close database connection
   *
   * Closes the SQLite database file.
   */
  close(): Promise<void> | void;

  /**
   * Test database connection
   *
   * Verifies that the database is accessible and responsive.
   * Returns true if connection is healthy, false otherwise.
   */
  testConnection(): Promise<boolean> | boolean;
}
