/**
 * Database Migrator Service
 *
 * Migration runner that executes SQLite migrations.
 * Uses Drizzle ORM for executing SQL statements.
 *
 */

import { injectable } from 'inversify';
import { sql } from 'drizzle-orm';
import { DrizzleDatabase } from '../drizzle/types.js';
import { createLogger } from '../../../lib/logger/logger.js';

const logger = createLogger('DatabaseMigrator');

/**
 * Migration record stored in the database
 */
export interface MigrationRecord {
  version: number;
  name: string;
  applied_at: string;
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  migrationsRun: number;
  currentVersion: number;
  errors: string[];
}

/**
 * Migration info from index files
 */
export interface MigrationInfo {
  version: number;
  name: string;
  filename: string;
  filepath: string;
}

/**
 * Database Migrator Service
 *
 * Implements migration runner that:
 * 1. Loads migrations from sqlite/ folder
 * 2. Tracks applied migrations in a migrations table
 * 3. Runs pending migrations in order
 * 4. Uses Drizzle ORM for executing SQL statements
 *
 */
@injectable()
export class DatabaseMigrator {
  private db: DrizzleDatabase | null = null;

  constructor() {
    logger.debug('DatabaseMigrator initialized');
  }

  /**
   * Set the database instance
   * Called by bootstrap to inject the database after it's created
   */
  setDatabase(db: DrizzleDatabase): void {
    this.db = db;
  }

  /**
   * Run all pending migrations
   *
   * @returns Migration result with success status and details
   */
  async runMigrations(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      migrationsRun: 0,
      currentVersion: 0,
      errors: [],
    };

    try {
      if (!this.db) {
        throw new Error('Database not set. Call setDatabase() first.');
      }

      logger.info('Running migrations...');

      // Ensure migrations table exists
      await this.ensureMigrationsTable();

      // Get current version
      const currentVersion = await this.getCurrentVersion();
      result.currentVersion = currentVersion;
      logger.debug(`Current migration version: ${currentVersion}`);

      // Load migrations
      const migrations = await this.loadMigrations();
      const pendingMigrations = migrations.filter(
        (m) => m.version > currentVersion
      );

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations');
        result.success = true;
        return result;
      }

      logger.info(`Found ${pendingMigrations.length} pending migrations`);

      // Run each pending migration
      for (const migration of pendingMigrations) {
        try {
          await this.runMigration(migration);
          result.migrationsRun++;
          result.currentVersion = migration.version;
          logger.info(
            `✅ Migration ${migration.version}: ${migration.name} applied`
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          result.errors.push(
            `Migration ${migration.version} failed: ${errorMessage}`
          );
          logger.error(
            `❌ Migration ${migration.version}: ${migration.name} failed`,
            error
          );
          // Stop on first error
          return result;
        }
      }

      result.success = true;
      logger.info(
        `✅ All migrations completed. Current version: ${result.currentVersion}`
      );
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
      logger.error('Migration failed:', error);
      return result;
    }
  }

  /**
   * Get current migration version
   */
  async getCurrentVersion(): Promise<number> {
    if (!this.db) {
      throw new Error('Database connection not set');
    }

    try {
      const drizzleDb = this.db.getDb() as any;
      const query = sql`SELECT MAX(version) as version FROM _migrations`;
      const rows = await drizzleDb.all(query);
      const result = Array.isArray(rows) ? rows : rows.rows || [];
      return result[0]?.version || 0;
    } catch {
      // Table might not exist yet
      return 0;
    }
  }

  /**
   * Get list of applied migrations
   */
  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    if (!this.db) {
      throw new Error('Database connection not set');
    }

    try {
      const drizzleDb = this.db.getDb() as any;
      const query = sql`SELECT version, name, applied_at FROM _migrations ORDER BY version`;
      const rows = await drizzleDb.all(query);
      return Array.isArray(rows) ? rows : rows.rows || [];
    } catch {
      return [];
    }
  }

  /**
   * Ensure migrations tracking table exists
   */
  private async ensureMigrationsTable(): Promise<void> {
    if (!this.db) {
      throw new Error('Database connection not set');
    }

    const drizzleDb = this.db.getDb() as any;
    const createTableSql = sql.raw(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);

    await drizzleDb.run(createTableSql);
    logger.debug('Migrations table ensured');
  }

  /**
   * Load migrations from sqlite folder
   */
  private async loadMigrations(): Promise<MigrationInfo[]> {
    const { getAllMigrations } = await import('./sqlite/index.js');
    return getAllMigrations();
  }

  /**
   * Run a single migration
   */
  private async runMigration(migration: MigrationInfo): Promise<void> {
    if (!this.db) {
      throw new Error('Database connection not set');
    }

    // Load migration SQL
    const migrationSql = await this.loadMigrationSql(migration);
    logger.debug(
      `Migration ${migration.version} SQL loaded (${migrationSql.length} chars)`
    );

    const drizzleDb = this.db.getDb() as any;

    // Execute migration in transaction (SQLite sync transaction)
    drizzleDb.transaction((tx: any) => {
      this.executeMigrationStatements(tx, migrationSql, migration);
    });
  }

  /**
   * Execute migration statements for SQLite (sync)
   */
  private executeMigrationStatements(
    tx: any,
    migrationSql: string,
    migration: MigrationInfo
  ): void {
    // Execute migration SQL
    // First remove all comment lines, then split by semicolons
    const sqlWithoutComments = migrationSql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    const statements = sqlWithoutComments
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    logger.debug(
      `Migration ${migration.version}: executing ${statements.length} statements`
    );

    for (const statement of statements) {
      logger.debug(`Executing: ${statement.substring(0, 100)}...`);
      tx.run(sql.raw(statement));
    }

    // Record migration
    tx.run(
      sql.raw(
        `INSERT INTO _migrations (version, name, applied_at) VALUES (${
          migration.version
        }, '${migration.name}', '${new Date().toISOString()}')`
      )
    );
  }

  /**
   * Load migration SQL content
   */
  private async loadMigrationSql(migration: MigrationInfo): Promise<string> {
    const { getMigrationSql } = await import('./sqlite/index.js');
    return getMigrationSql(migration.version);
  }
}

/**
 * Create a standalone migrator instance
 * Useful for scripts and CLI tools
 */
export function createMigrator(): DatabaseMigrator {
  return new DatabaseMigrator();
}
