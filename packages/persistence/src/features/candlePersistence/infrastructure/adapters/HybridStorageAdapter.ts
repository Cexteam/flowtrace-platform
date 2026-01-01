/**
 * Hybrid Storage Adapter
 * Facade adapter that delegates to either SQLite or file storage based on configuration.
 * Provides unified interface for both storage modes with runtime switching capability.
 */

import { injectable, inject, Container } from 'inversify';
import type { FootprintCandle } from '@flowtrace/core';
import type { CandleStoragePort } from '../../application/ports/out/CandleStoragePort.js';
import { BinaryStorageAdapter } from './BinaryStorageAdapter.js';
import { SQLiteFlatBufferStorage } from './SQLiteFlatBufferStorage.js';
import type { SQLiteStorageConfig } from './SQLiteFlatBufferStorage.js';
import { CANDLE_PERSISTENCE_TYPES } from '../../di/types.js';

export interface HybridStorageConfig {
  /** Base directory for storage files */
  baseDir: string;

  /** Use database storage (true) or file storage (false) */
  useDatabase?: boolean;

  /** Organize databases by exchange (only for database mode) */
  organizeByExchange?: boolean;

  /** Maximum candles per block/batch operation */
  maxCandlesPerBlock?: number;

  /** Enable WAL mode (only for database mode) */
  walMode?: boolean;

  /** Cache size in KB (only for database mode) */
  cacheSize?: number;

  /** Memory-mapped I/O size in bytes (only for database mode) */
  mmapSize?: number;
}

/**
 * Hybrid Storage Adapter
 * Facade that provides a unified interface for both SQLite database and file-based storage.
 * Delegates operations to the appropriate storage implementation based on configuration.
 * Ensures identical interface behavior regardless of storage mode.
 */
@injectable()
export class HybridStorageAdapter implements CandleStoragePort {
  private sqliteStorage?: SQLiteFlatBufferStorage;
  private fileStorage?: BinaryStorageAdapter;
  private useDatabase: boolean;
  private config: HybridStorageConfig;

  constructor(
    @inject(CANDLE_PERSISTENCE_TYPES.HybridStorageConfig)
    config: HybridStorageConfig
  ) {
    this.config = config;
    this.useDatabase = config.useDatabase ?? true;

    if (this.useDatabase) {
      // Initialize SQLite storage
      const sqliteConfig: SQLiteStorageConfig = {
        baseDir: config.baseDir,
        organizeByExchange: config.organizeByExchange,
        maxCandlesPerBatch: config.maxCandlesPerBlock,
        walMode: config.walMode,
        cacheSize: config.cacheSize,
        mmapSize: config.mmapSize,
      };
      this.sqliteStorage = new SQLiteFlatBufferStorage(sqliteConfig);
    } else {
      // Initialize file storage
      const fileConfig = {
        baseDir: config.baseDir,
        maxCandlesPerBlock: config.maxCandlesPerBlock,
      };
      this.fileStorage = this.createBinaryStorageAdapter(fileConfig);
    }
  }

  /**
   * Create BinaryStorageAdapter instance without DI
   */
  private createBinaryStorageAdapter(config: {
    baseDir: string;
    maxCandlesPerBlock?: number;
  }): BinaryStorageAdapter {
    // Use a simple approach - create a temporary container just for this instance
    const tempContainer = new Container();
    tempContainer
      .bind(CANDLE_PERSISTENCE_TYPES.StorageConfig)
      .toConstantValue(config);
    tempContainer.bind(BinaryStorageAdapter).toSelf();

    return tempContainer.get(BinaryStorageAdapter);
  }

  /**
   * Get the active storage implementation
   */
  private getActiveStorage(): CandleStoragePort {
    if (this.useDatabase) {
      if (!this.sqliteStorage) {
        throw new Error('SQLite storage not initialized');
      }
      return this.sqliteStorage;
    } else {
      if (!this.fileStorage) {
        throw new Error('File storage not initialized');
      }
      return this.fileStorage;
    }
  }

  /**
   * Switch storage mode at runtime
   *
   * @param useDatabase - Whether to use database storage
   */
  async switchStorageMode(useDatabase: boolean): Promise<void> {
    if (this.useDatabase === useDatabase) {
      return; // Already using the requested mode
    }

    this.useDatabase = useDatabase;

    if (useDatabase && !this.sqliteStorage) {
      // Initialize SQLite storage
      const sqliteConfig: SQLiteStorageConfig = {
        baseDir: this.config.baseDir,
        organizeByExchange: this.config.organizeByExchange,
        maxCandlesPerBatch: this.config.maxCandlesPerBlock,
        walMode: this.config.walMode,
        cacheSize: this.config.cacheSize,
        mmapSize: this.config.mmapSize,
      };
      this.sqliteStorage = new SQLiteFlatBufferStorage(sqliteConfig);
      await this.sqliteStorage.initialize();
    } else if (!useDatabase && !this.fileStorage) {
      // Initialize file storage
      const fileConfig = {
        baseDir: this.config.baseDir,
        maxCandlesPerBlock: this.config.maxCandlesPerBlock,
      };
      this.fileStorage = this.createBinaryStorageAdapter(fileConfig);
    }

    console.log(
      `Switched to ${useDatabase ? 'database' : 'file'} storage mode`
    );
  }

  /**
   * Get current storage mode
   */
  getStorageMode(): 'database' | 'file' {
    return this.useDatabase ? 'database' : 'file';
  }

  /**
   * Get storage configuration
   */
  getConfig(): Readonly<HybridStorageConfig> {
    return { ...this.config };
  }

  /**
   * Initialize the storage adapter
   */
  async initialize(): Promise<void> {
    if (this.useDatabase && this.sqliteStorage) {
      await this.sqliteStorage.initialize();
    }
    // File storage doesn't need initialization
  }

  /**
   * Close the storage adapter
   */
  async close(): Promise<void> {
    if (this.useDatabase && this.sqliteStorage) {
      await this.sqliteStorage.close();
    }
    // File storage doesn't need explicit closing
  }

  // ============================================================================
  // CandleStoragePort Interface Implementation
  // ============================================================================

  /**
   * Save a single candle to storage
   */
  async save(candle: FootprintCandle): Promise<void> {
    const storage = this.getActiveStorage();
    return storage.save(candle);
  }

  /**
   * Save multiple candles to storage (batch operation)
   */
  async saveMany(candles: FootprintCandle[]): Promise<void> {
    const storage = this.getActiveStorage();
    return storage.saveMany(candles);
  }

  /**
   * Find candles by symbol, exchange, and timeframe
   */
  async findBySymbol(
    symbol: string,
    exchange: string,
    timeframe: string,
    options?: {
      startTime?: number;
      endTime?: number;
      limit?: number;
    }
  ): Promise<FootprintCandle[]> {
    const storage = this.getActiveStorage();
    return storage.findBySymbol(symbol, exchange, timeframe, options);
  }

  /**
   * Find the latest candle for a symbol
   */
  async findLatest(
    symbol: string,
    exchange: string,
    timeframe: string
  ): Promise<FootprintCandle | null> {
    const storage = this.getActiveStorage();
    return storage.findLatest(symbol, exchange, timeframe);
  }

  /**
   * Flush any pending operations
   */
  async flush(): Promise<void> {
    const storage = this.getActiveStorage();

    // Call flush if the method exists (it should for both implementations)
    if ('flush' in storage && typeof storage.flush === 'function') {
      return storage.flush();
    }
  }

  // ============================================================================
  // Additional Methods for Management
  // ============================================================================

  /**
   * Health check for active storage
   */
  async healthCheck(): Promise<boolean> {
    try {
      const storage = this.getActiveStorage();

      if (
        this.useDatabase &&
        this.sqliteStorage &&
        'healthCheck' in this.sqliteStorage
      ) {
        return this.sqliteStorage.healthCheck();
      }

      // For file storage, just check if we can access the storage
      return true;
    } catch (error) {
      console.error('Storage health check failed:', error);
      return false;
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<Map<string, any> | null> {
    if (
      this.useDatabase &&
      this.sqliteStorage &&
      'getStats' in this.sqliteStorage
    ) {
      return this.sqliteStorage.getStats();
    }

    // File storage doesn't provide detailed stats
    return null;
  }

  /**
   * Optimize storage
   */
  async optimize(): Promise<void> {
    if (
      this.useDatabase &&
      this.sqliteStorage &&
      'optimize' in this.sqliteStorage
    ) {
      await this.sqliteStorage.optimize();
    }

    // File storage doesn't need optimization
  }
}
