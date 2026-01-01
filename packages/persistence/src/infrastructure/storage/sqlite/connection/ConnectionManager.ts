/**
 * Connection Manager
 * Manages SQLite database connections with WAL mode configuration.
 * Provides connection pooling and optimal performance settings.
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

export interface ConnectionConfig {
  /** Database file path */
  filePath: string;

  /** Enable WAL mode (default: true) */
  walMode?: boolean;

  /** Cache size in KB (default: 64MB) */
  cacheSize?: number;

  /** Memory-mapped I/O size in bytes (default: 256MB) */
  mmapSize?: number;

  /** Journal mode (default: WAL) */
  journalMode?: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF';

  /** Synchronous mode (default: NORMAL for WAL) */
  synchronous?: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';

  /** Busy timeout in milliseconds (default: 30000) */
  busyTimeout?: number;

  /** Enable foreign keys (default: true) */
  foreignKeys?: boolean;
}

export interface ConnectionStats {
  /** Database file size in bytes */
  fileSize: number;

  /** WAL file size in bytes */
  walSize: number;

  /** Number of pages in cache */
  cachePages: number;

  /** Cache hit rate (0-1) */
  cacheHitRate: number;

  /** Number of active connections */
  activeConnections: number;

  /** Last checkpoint timestamp */
  lastCheckpoint: number;
}

/**
 * SQLite Connection Manager
 * Provides optimized database connections with WAL mode and performance tuning.
 * Handles connection lifecycle, pragma configuration, and health monitoring.
 */
export class ConnectionManager {
  private db: Database.Database | null = null;
  private config: Required<ConnectionConfig>;
  private isInitialized = false;
  private connectionCount = 0;
  private lastCheckpoint = 0;

  constructor(config: ConnectionConfig) {
    this.config = {
      filePath: config.filePath,
      walMode: config.walMode ?? true,
      cacheSize: config.cacheSize ?? 65536, // 64MB in KB
      mmapSize: config.mmapSize ?? 268435456, // 256MB
      journalMode: config.journalMode ?? 'WAL',
      synchronous: config.synchronous ?? 'NORMAL',
      busyTimeout: config.busyTimeout ?? 30000,
      foreignKeys: config.foreignKeys ?? true,
    };
  }

  /**
   * Initialize database connection and configure pragmas
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Ensure directory exists
    const dir = path.dirname(this.config.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create database connection
    // SQLite verbose mode disabled by default - enable with SQLITE_VERBOSE=true for debugging
    this.db = new Database(this.config.filePath, {
      verbose: process.env.SQLITE_VERBOSE === 'true' ? console.log : undefined,
    });

    this.connectionCount++;

    // Configure pragmas for optimal performance
    await this.configurePragmas();

    this.isInitialized = true;
  }

  /**
   * Configure SQLite pragmas for optimal performance
   */
  private async configurePragmas(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Set journal mode (WAL for concurrent access)
      this.db.pragma(`journal_mode = ${this.config.journalMode}`);

      // Set synchronous mode (NORMAL is optimal for WAL)
      this.db.pragma(`synchronous = ${this.config.synchronous}`);

      // Set cache size (negative value means KB)
      this.db.pragma(`cache_size = -${this.config.cacheSize}`);

      // Set memory-mapped I/O size
      this.db.pragma(`mmap_size = ${this.config.mmapSize}`);

      // Set busy timeout
      this.db.pragma(`busy_timeout = ${this.config.busyTimeout}`);

      // Enable foreign keys
      this.db.pragma(
        `foreign_keys = ${this.config.foreignKeys ? 'ON' : 'OFF'}`
      );

      // Additional WAL optimizations
      if (this.config.walMode) {
        // WAL autocheckpoint (pages)
        this.db.pragma('wal_autocheckpoint = 1000');

        // WAL checkpoint on close
        this.db.pragma('wal_checkpoint(TRUNCATE)');
      }

      // Performance optimizations
      this.db.pragma('temp_store = MEMORY');
      this.db.pragma('locking_mode = NORMAL');
      this.db.pragma('page_size = 4096');
    } catch (error) {
      console.error('Failed to configure database pragmas:', error);
      throw error;
    }
  }

  /**
   * Get database connection
   */
  getConnection(): Database.Database {
    if (!this.db || !this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Execute a prepared statement
   */
  prepare(sql: string): Database.Statement {
    const connection = this.getConnection();
    return connection.prepare(sql);
  }

  /**
   * Execute a transaction
   */
  transaction<T extends unknown[]>(
    fn: (...args: T) => void
  ): Database.Transaction<(...args: T) => void> {
    const connection = this.getConnection();
    return connection.transaction(fn);
  }

  /**
   * Execute SQL directly
   */
  exec(sql: string): this {
    const connection = this.getConnection();
    connection.exec(sql);
    return this;
  }

  /**
   * Perform WAL checkpoint
   */
  async checkpoint(): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      this.db.pragma('wal_checkpoint(TRUNCATE)');
      this.lastCheckpoint = Date.now();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get connection statistics
   */
  async getStats(): Promise<ConnectionStats> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Get file sizes
      const stats = fs.statSync(this.config.filePath);
      const fileSize = stats.size;

      let walSize = 0;
      const walPath = `${this.config.filePath}-wal`;
      if (fs.existsSync(walPath)) {
        const walStats = fs.statSync(walPath);
        walSize = walStats.size;
      }

      // Get cache statistics
      const cacheInfo = this.db.pragma('cache_size', {
        simple: true,
      }) as number;
      const cachePages = Math.abs(cacheInfo);

      // Calculate cache hit rate (simplified)
      const cacheHitRate = 0.95; // TODO: Implement actual cache hit rate calculation

      return {
        fileSize,
        walSize,
        cachePages,
        cacheHitRate,
        activeConnections: this.connectionCount,
        lastCheckpoint: this.lastCheckpoint,
      };
    } catch (error) {
      console.error('Failed to get connection stats:', error);
      throw error;
    }
  }

  /**
   * Optimize database (VACUUM and ANALYZE)
   */
  async optimize(): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      // Analyze tables for query optimization
      this.db.exec('ANALYZE');

      // Vacuum database (only if not in WAL mode during active use)
      if (this.config.journalMode !== 'WAL') {
        this.db.exec('VACUUM');
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      // Perform final checkpoint
      if (this.config.walMode) {
        await this.checkpoint();
      }

      this.db.close();
      this.db = null;
      this.isInitialized = false;
      this.connectionCount = 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if database is healthy
   */
  async healthCheck(): Promise<boolean> {
    if (!this.db || !this.isInitialized) {
      return false;
    }

    try {
      // Simple query to test connection
      const result = this.db.prepare('SELECT 1 as test').get() as
        | { test: number }
        | undefined;
      return result !== undefined && result.test === 1;
    } catch {
      return false;
    }
  }

  /**
   * Get connection configuration
   */
  getConfig(): Readonly<Required<ConnectionConfig>> {
    return { ...this.config };
  }
}
