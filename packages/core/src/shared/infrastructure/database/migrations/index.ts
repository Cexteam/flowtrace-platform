/**
 * Database Migrations - Barrel Export
 *
 * Exports migration utilities for SQLite.
 *
 */

// Re-export migration info type from SQLite
export type { MigrationInfo } from './sqlite/index.js';

// SQLite migrations
export {
  SQLITE_MIGRATIONS,
  getMigrationSql,
  getAllMigrations,
  getLatestVersion,
} from './sqlite/index.js';

// Migrator and Bootstrap
export {
  DatabaseMigrator,
  createMigrator,
  type MigrationRecord,
  type MigrationResult,
} from './migrator.js';

export {
  runMigrations,
  bootstrapDatabase,
  bootstrapDatabaseLazy,
  bindMigrator,
  type DatabaseBootstrapOptions,
  type DatabaseBootstrapResult,
} from './bootstrap.js';
