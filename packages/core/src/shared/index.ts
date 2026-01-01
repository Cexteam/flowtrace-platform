/**
 * Shared utilities and infrastructure exports
 */

// Application lifecycle
export * from './application/index.js';

// DI configuration
export * from './lib/di/index.js';

// Logger
export * from './lib/logger/logger.js';

// Infrastructure - Database (SQLite only)
export {
  SqliteConfig,
  DatabaseConfig,
  DatabaseMigrator,
  createMigrator,
  bootstrapDatabase,
  bootstrapDatabaseLazy,
  runMigrations,
  bindMigrator,
  DrizzleDatabase,
  DrizzleSqliteDatabase,
} from './infrastructure/database/index.js';
export type {
  MigrationRecord,
  MigrationResult,
  DatabaseBootstrapOptions,
  DatabaseBootstrapResult,
} from './infrastructure/database/index.js';
export * from './infrastructure/database/schema/index.js';
export * from './infrastructure/database/migrations/index.js';
