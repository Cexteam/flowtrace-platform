/**
 * Schema Manager
 * Manages database schema creation, migration, and versioning.
 * Creates optimized table structures for candle storage.
 */

import type { ConnectionManager } from '../connection/ConnectionManager.js';

export interface SchemaVersion {
  version: number;
  description: string;
  sql: string;
  rollback?: string;
}

export interface SchemaInfo {
  currentVersion: number;
  availableVersions: number[];
  tables: string[];
  indexes: string[];
}

/**
 * Database Schema Manager
 * Handles schema creation, migration, and versioning for SQLite databases.
 * Creates optimized table structures and indexes for candle storage.
 */
export class SchemaManager {
  private connectionManager: ConnectionManager;
  private migrations: Map<number, SchemaVersion> = new Map();

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.initializeMigrations();
  }

  /**
   * Initialize migration definitions
   */
  private initializeMigrations(): void {
    // Version 1: Initial schema
    this.migrations.set(1, {
      version: 1,
      description: 'Initial candles table and indexes',
      sql: `
        -- Schema version tracking
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY,
          applied_at INTEGER NOT NULL,
          description TEXT
        );

        -- Main candles table
        CREATE TABLE IF NOT EXISTS candles (
          id TEXT PRIMARY KEY,                    -- {exchange}:{symbol}:{timeframe}:{openTime}
          symbol TEXT NOT NULL,                   -- Trading pair symbol
          exchange TEXT NOT NULL,                 -- Exchange identifier
          timeframe TEXT NOT NULL,                -- Candle timeframe
          open_time INTEGER NOT NULL,             -- Candle open timestamp
          close_time INTEGER NOT NULL,            -- Candle close timestamp
          data BLOB NOT NULL,                     -- FlatBuffer serialized candle
          created_at INTEGER NOT NULL,            -- Record creation time
          updated_at INTEGER NOT NULL             -- Record update time
        );

        -- Optimized indexes for common query patterns
        CREATE INDEX IF NOT EXISTS idx_symbol_timeframe ON candles(symbol, timeframe, open_time);
        CREATE INDEX IF NOT EXISTS idx_exchange_symbol ON candles(exchange, symbol);
        CREATE INDEX IF NOT EXISTS idx_time_range ON candles(open_time, close_time);
        CREATE INDEX IF NOT EXISTS idx_latest_candles ON candles(symbol, exchange, timeframe, open_time DESC);
        CREATE INDEX IF NOT EXISTS idx_exchange_time ON candles(exchange, open_time);
      `,
      rollback: `
        DROP INDEX IF EXISTS idx_exchange_time;
        DROP INDEX IF EXISTS idx_latest_candles;
        DROP INDEX IF EXISTS idx_time_range;
        DROP INDEX IF EXISTS idx_exchange_symbol;
        DROP INDEX IF EXISTS idx_symbol_timeframe;
        DROP TABLE IF EXISTS candles;
        DROP TABLE IF EXISTS schema_version;
      `,
    });

    // Version 2: Performance indexes
    this.migrations.set(2, {
      version: 2,
      description: 'Additional performance indexes',
      sql: `
        -- Composite index for cross-symbol queries
        CREATE INDEX IF NOT EXISTS idx_cross_symbol ON candles(exchange, timeframe, open_time);
        
        -- Index for data size optimization queries
        CREATE INDEX IF NOT EXISTS idx_data_size ON candles(exchange, symbol, length(data));
        
        -- Partial index for recent data (using fixed timestamp for deterministic behavior)
        CREATE INDEX IF NOT EXISTS idx_recent_candles ON candles(symbol, exchange, timeframe, open_time) 
        WHERE open_time > 1600000000000;
      `,
      rollback: `
        DROP INDEX IF EXISTS idx_recent_candles;
        DROP INDEX IF EXISTS idx_data_size;
        DROP INDEX IF EXISTS idx_cross_symbol;
      `,
    });
  }

  /**
   * Create initial schema
   */
  async createSchema(): Promise<void> {
    const db = this.connectionManager.getConnection();

    try {
      console.log('Creating database schema...');

      // Apply all migrations in order
      const versions = Array.from(this.migrations.keys()).sort((a, b) => a - b);

      for (const version of versions) {
        await this.applyMigration(version);
      }

      console.log('Database schema created successfully');
    } catch (error) {
      console.error('Failed to create schema:', error);
      throw error;
    }
  }

  /**
   * Apply a specific migration
   */
  async applyMigration(version: number): Promise<void> {
    const migration = this.migrations.get(version);
    if (!migration) {
      throw new Error(`Migration version ${version} not found`);
    }

    const currentVersion = await this.getCurrentVersion();
    if (currentVersion >= version) {
      console.log(`Migration ${version} already applied`);
      return;
    }

    const db = this.connectionManager.getConnection();

    try {
      console.log(`Applying migration ${version}: ${migration.description}`);

      // Execute migration in transaction
      const transaction = db.transaction(() => {
        // Execute migration SQL
        db.exec(migration.sql);

        // Update schema version
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO schema_version (version, applied_at, description)
          VALUES (?, ?, ?)
        `);
        stmt.run(version, Date.now(), migration.description);
      });

      transaction();

      console.log(`Migration ${version} applied successfully`);
    } catch (error) {
      console.error(`Failed to apply migration ${version}:`, error);
      throw error;
    }
  }

  /**
   * Rollback a migration
   */
  async rollbackMigration(version: number): Promise<void> {
    const migration = this.migrations.get(version);
    if (!migration || !migration.rollback) {
      throw new Error(`Migration ${version} rollback not available`);
    }

    const currentVersion = await this.getCurrentVersion();
    if (currentVersion < version) {
      console.log(`Migration ${version} not applied, nothing to rollback`);
      return;
    }

    const db = this.connectionManager.getConnection();

    try {
      console.log(
        `Rolling back migration ${version}: ${migration.description}`
      );

      // Execute rollback in transaction
      const transaction = db.transaction(() => {
        // Execute rollback SQL
        db.exec(migration.rollback!);

        // Remove from schema version
        const stmt = db.prepare('DELETE FROM schema_version WHERE version = ?');
        stmt.run(version);
      });

      transaction();

      console.log(`Migration ${version} rolled back successfully`);
    } catch (error) {
      console.error(`Failed to rollback migration ${version}:`, error);
      throw error;
    }
  }

  /**
   * Get current schema version
   */
  async getCurrentVersion(): Promise<number> {
    const db = this.connectionManager.getConnection();

    try {
      // Check if schema_version table exists
      const tableExists = db
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='schema_version'
      `
        )
        .get();

      if (!tableExists) {
        return 0;
      }

      // Get latest version
      const result = db
        .prepare(
          `
        SELECT MAX(version) as version FROM schema_version
      `
        )
        .get() as { version: number } | undefined;

      return result?.version || 0;
    } catch (error) {
      console.error('Failed to get current schema version:', error);
      return 0;
    }
  }

  /**
   * Get schema information
   */
  async getSchemaInfo(): Promise<SchemaInfo> {
    const db = this.connectionManager.getConnection();

    try {
      const currentVersion = await this.getCurrentVersion();
      const availableVersions = Array.from(this.migrations.keys()).sort(
        (a, b) => a - b
      );

      // Get table names
      const tables = db
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `
        )
        .all() as { name: string }[];

      // Get index names
      const indexes = db
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `
        )
        .all() as { name: string }[];

      return {
        currentVersion,
        availableVersions,
        tables: tables.map((t) => t.name),
        indexes: indexes.map((i) => i.name),
      };
    } catch (error) {
      console.error('Failed to get schema info:', error);
      throw error;
    }
  }

  /**
   * Validate schema integrity
   */
  async validateSchema(): Promise<boolean> {
    const db = this.connectionManager.getConnection();

    try {
      // Run PRAGMA integrity_check
      const result = db.prepare('PRAGMA integrity_check').get() as {
        integrity_check: string;
      };

      if (result.integrity_check !== 'ok') {
        console.error('Schema integrity check failed:', result.integrity_check);
        return false;
      }

      // Check if required tables exist
      const requiredTables = ['candles', 'schema_version'];
      const schemaInfo = await this.getSchemaInfo();

      for (const table of requiredTables) {
        if (!schemaInfo.tables.includes(table)) {
          console.error(`Required table missing: ${table}`);
          return false;
        }
      }

      // Check if required indexes exist
      const requiredIndexes = [
        'idx_symbol_timeframe',
        'idx_exchange_symbol',
        'idx_time_range',
        'idx_latest_candles',
      ];

      for (const index of requiredIndexes) {
        if (!schemaInfo.indexes.includes(index)) {
          console.error(`Required index missing: ${index}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Schema validation failed:', error);
      return false;
    }
  }

  /**
   * Drop all tables and indexes
   */
  async dropSchema(): Promise<void> {
    const db = this.connectionManager.getConnection();

    try {
      console.log('Dropping database schema...');

      // Get all user tables and indexes
      const tables = db
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `
        )
        .all() as { name: string }[];

      const indexes = db
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
      `
        )
        .all() as { name: string }[];

      // Drop in transaction
      const transaction = db.transaction(() => {
        // Drop indexes first
        for (const index of indexes) {
          db.exec(`DROP INDEX IF EXISTS ${index.name}`);
        }

        // Drop tables
        for (const table of tables) {
          db.exec(`DROP TABLE IF EXISTS ${table.name}`);
        }
      });

      transaction();

      console.log('Database schema dropped successfully');
    } catch (error) {
      console.error('Failed to drop schema:', error);
      throw error;
    }
  }

  /**
   * Create exchange-specific table (for partitioning)
   */
  async createExchangeTable(exchange: string): Promise<void> {
    const db = this.connectionManager.getConnection();
    const tableName = `${exchange}_candles`;

    try {
      console.log(`Creating exchange table: ${tableName}`);

      const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id TEXT PRIMARY KEY,
          symbol TEXT NOT NULL,
          exchange TEXT NOT NULL,
          timeframe TEXT NOT NULL,
          open_time INTEGER NOT NULL,
          close_time INTEGER NOT NULL,
          data BLOB NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        -- Exchange-specific indexes
        CREATE INDEX IF NOT EXISTS idx_${exchange}_symbol_timeframe ON ${tableName}(symbol, timeframe, open_time);
        CREATE INDEX IF NOT EXISTS idx_${exchange}_time_range ON ${tableName}(open_time, close_time);
        CREATE INDEX IF NOT EXISTS idx_${exchange}_latest ON ${tableName}(symbol, timeframe, open_time DESC);
      `;

      db.exec(sql);

      console.log(`Exchange table ${tableName} created successfully`);
    } catch (error) {
      console.error(`Failed to create exchange table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Get available migrations
   */
  getAvailableMigrations(): SchemaVersion[] {
    return Array.from(this.migrations.values()).sort(
      (a, b) => a.version - b.version
    );
  }
}
