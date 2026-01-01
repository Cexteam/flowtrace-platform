/**
 * Database Bootstrap Helper
 *
 * Provides utilities for bootstrapping database connections and running migrations.
 * Used by both server and desktop applications with unified SQLite configuration.
 *
 */

import { DrizzleDatabase } from '../drizzle/types.js';
import { DATABASE_SYMBOLS } from '../../../lib/di/bindings/core/database/types.js';
import { DatabaseMigrator, MigrationResult } from './migrator.js';
import { createLogger } from '../../../lib/logger/logger.js';
import { Container } from 'inversify';

const logger = createLogger('DatabaseBootstrap');

/**
 * Bootstrap options
 */
export interface DatabaseBootstrapOptions {
  /** Run migrations on startup (default: true) */
  runMigrations?: boolean;
  /** Fail if migrations fail (default: true in production, false in development) */
  failOnMigrationError?: boolean;
}

/**
 * Bootstrap result
 */
export interface DatabaseBootstrapResult {
  /** Whether bootstrap was successful */
  success: boolean;
  /** Migration result (if migrations were run) */
  migrationResult?: MigrationResult;
  /** Error message (if bootstrap failed) */
  error?: string;
}

/**
 * Run database migrations using the provided Drizzle database
 *
 * @param db - Drizzle database instance to use
 * @returns Migration result
 */
export async function runMigrations(
  db: DrizzleDatabase
): Promise<MigrationResult> {
  logger.info('Running database migrations...');

  const migrator = new DatabaseMigrator();
  migrator.setDatabase(db);

  const result = await migrator.runMigrations();

  if (result.success) {
    logger.info(
      `✅ Migrations completed successfully. Version: ${result.currentVersion}, Migrations run: ${result.migrationsRun}`
    );
  } else {
    logger.error(`❌ Migrations failed:`, result.errors);
  }

  return result;
}

/**
 * Bootstrap database with migrations
 *
 * This function:
 * 1. Gets or creates the database connection
 * 2. Runs pending migrations
 * 3. Returns the result
 *
 * @param container - Inversify container with database bindings
 * @param options - Bootstrap options
 * @returns Bootstrap result
 */
export async function bootstrapDatabase(
  container: Container,
  options: DatabaseBootstrapOptions = {}
): Promise<DatabaseBootstrapResult> {
  const {
    runMigrations: shouldRunMigrations = true,
    failOnMigrationError = process.env.NODE_ENV === 'production',
  } = options;

  logger.info('Bootstrapping database...');

  try {
    // Get the database connection from container
    let db: DrizzleDatabase;

    if (container.isBound(DATABASE_SYMBOLS.DrizzleDatabase)) {
      db = container.get<DrizzleDatabase>(DATABASE_SYMBOLS.DrizzleDatabase);
    } else {
      throw new Error('DrizzleDatabase not bound in container');
    }

    // Test connection
    const connected = await db.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to database');
    }
    logger.info('✅ Database connection established');

    // Run migrations if enabled
    let migrationResult: MigrationResult | undefined;
    if (shouldRunMigrations) {
      migrationResult = await runMigrations(db);

      if (!migrationResult.success && failOnMigrationError) {
        throw new Error(
          `Migration failed: ${migrationResult.errors.join(', ')}`
        );
      }
    }

    return {
      success: true,
      migrationResult,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Database bootstrap failed:', error);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Bootstrap database with lazy connection
 *
 * This function is useful when you want to run migrations before
 * the lazy connection is first used.
 *
 * @param container - Inversify container with lazy connection bindings
 * @param options - Bootstrap options
 * @returns Bootstrap result
 */
export async function bootstrapDatabaseLazy(
  container: Container,
  options: DatabaseBootstrapOptions = {}
): Promise<DatabaseBootstrapResult> {
  const {
    runMigrations: shouldRunMigrations = true,
    failOnMigrationError = process.env.NODE_ENV === 'production',
  } = options;

  logger.info('Bootstrapping database (lazy)...');

  try {
    // Get the Drizzle database instance
    if (!container.isBound(DATABASE_SYMBOLS.DrizzleDatabase)) {
      // Fall back to regular bootstrap if DrizzleDatabase not bound
      return bootstrapDatabase(container, options);
    }

    const drizzleDb = container.get<DrizzleDatabase>(
      DATABASE_SYMBOLS.DrizzleDatabase
    );

    // Test connection
    await drizzleDb.testConnection();
    logger.info('✅ Database connection established (lazy)');

    // Run migrations if enabled
    let migrationResult: MigrationResult | undefined;
    if (shouldRunMigrations) {
      migrationResult = await runMigrations(drizzleDb);

      if (!migrationResult.success && failOnMigrationError) {
        throw new Error(
          `Migration failed: ${migrationResult.errors.join(', ')}`
        );
      }
    }

    return {
      success: true,
      migrationResult,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Database bootstrap (lazy) failed:', error);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Bind migrator to container
 *
 * @param container - Inversify container
 */
export function bindMigrator(container: Container): void {
  if (!container.isBound(DATABASE_SYMBOLS.DatabaseMigrator)) {
    container
      .bind<DatabaseMigrator>(DATABASE_SYMBOLS.DatabaseMigrator)
      .toDynamicValue(() => new DatabaseMigrator())
      .inSingletonScope();
  }
}
