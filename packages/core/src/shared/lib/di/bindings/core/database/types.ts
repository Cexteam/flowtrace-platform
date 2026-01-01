/**
 * Database DI Symbols
 *
 * Single source of truth for all database-related DI symbols.
 * Consistent with feature bindings pattern.
 *
 */

/**
 * DI symbols for database infrastructure
 *
 * All database-related dependency injection symbols are defined here
 * to maintain a single source of truth and prevent symbol conflicts.
 */
export const DATABASE_SYMBOLS = Object.freeze({
  /** Database configuration */
  DatabaseConfig: Symbol.for('DatabaseConfig'),

  /** Database migrator */
  DatabaseMigrator: Symbol.for('DatabaseMigrator'),

  /** Drizzle ORM database instance */
  DrizzleDatabase: Symbol.for('DrizzleDatabase'),
} as const);
