/**
 * Hybrid Storage Adapter
 * Facade adapter that delegates to either SQLite or hierarchical file storage.
 * Provides unified interface for both storage modes with runtime switching capability.
 *
 * Storage modes:
 * - Database (SQLite): Default mode, uses SQLiteFlatBufferStorage
 * - File (Local): Uses HierarchicalFileStorage with LocalFileStorageAdapter
 * - File (Cloud): Uses HierarchicalFileStorage with CloudFileStorageAdapter (GCS)
 */

import { injectable, inject, optional } from 'inversify';
import type { FootprintCandle } from '@flowtrace/core';
import type { CandleStoragePort } from '../../../application/ports/out/CandleStoragePort.js';
import type { FileStoragePort } from '../../../application/ports/out/FileStoragePort.js';
import type { CompressedCandleSerializerPort } from '../../../application/ports/out/CompressedCandleSerializerPort.js';
import { HierarchicalFileStorage } from './HierarchicalFileStorage.js';
import { LocalFileStorageAdapter } from '../file/LocalFileStorageAdapter.js';
import { SQLiteFlatBufferStorage } from './SQLiteFlatBufferStorage.js';
import type { SQLiteStorageConfig } from './SQLiteFlatBufferStorage.js';
import type {
  CloudStorageConfig,
  HierarchicalStorageConfig,
} from '../../../../../infrastructure/storage/hierarchical/types.js';
import { CANDLE_PERSISTENCE_TYPES } from '../../../di/types.js';

export interface HybridStorageConfig {
  /** Base directory for storage files */
  baseDir: string;

  /** Use database storage (true) or file storage (false) */
  useDatabase?: boolean;

  /** File storage location when useDatabase is false */
  fileStorageLocation?: 'local' | 'cloud';

  /** Cloud storage configuration (required if fileStorageLocation is 'cloud') */
  cloudStorageConfig?: CloudStorageConfig;

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

  /** Enable automatic metadata updates (file mode only) */
  autoUpdateMetadata?: boolean;
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
  private useDatabase: boolean;
  private config: HybridStorageConfig;

  constructor(
    @inject(CANDLE_PERSISTENCE_TYPES.HybridStorageConfig)
    config: HybridStorageConfig,
    @inject(CANDLE_PERSISTENCE_TYPES.HierarchicalFileStorage)
    @optional()
    private hierarchicalStorage?: HierarchicalFileStorage,
    @inject(CANDLE_PERSISTENCE_TYPES.CompressedCandleSerializerPort)
    @optional()
    private serializer?: CompressedCandleSerializerPort
  ) {
    this.config = config;
    this.useDatabase = config.useDatabase ?? true;

    if (this.useDatabase) {
      // Initialize SQLite storage with serializer
      const sqliteConfig: SQLiteStorageConfig = {
        baseDir: config.baseDir,
        organizeByExchange: config.organizeByExchange,
        maxCandlesPerBatch: config.maxCandlesPerBlock,
        walMode: config.walMode,
        cacheSize: config.cacheSize,
        mmapSize: config.mmapSize,
        serializer: this.serializer,
      };
      this.sqliteStorage = new SQLiteFlatBufferStorage(sqliteConfig);
    } else {
      // Hierarchical file storage is injected via DI
      if (!this.hierarchicalStorage) {
        throw new Error(
          'HierarchicalFileStorage must be injected when useDatabase is false'
        );
      }
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
      // Initialize SQLite storage with serializer
      const sqliteConfig: SQLiteStorageConfig = {
        baseDir: this.config.baseDir,
        organizeByExchange: this.config.organizeByExchange,
        maxCandlesPerBatch: this.config.maxCandlesPerBlock,
        walMode: this.config.walMode,
        cacheSize: this.config.cacheSize,
        mmapSize: this.config.mmapSize,
        serializer: this.serializer,
      };
      this.sqliteStorage = new SQLiteFlatBufferStorage(sqliteConfig);
      await this.sqliteStorage.initialize();
    } else if (!useDatabase && !this.hierarchicalStorage) {
      // Cannot switch to file mode without DI-injected HierarchicalFileStorage
      throw new Error(
        'Cannot switch to file storage mode: HierarchicalFileStorage not available'
      );
    }

    console.log(
      `Switched to ${useDatabase ? 'database' : 'file'} storage mode`
    );
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
      if (!this.hierarchicalStorage) {
        throw new Error('Hierarchical file storage not initialized');
      }
      return this.hierarchicalStorage;
    }
  }

  /**
   * Get current storage mode
   */
  getStorageMode(): 'database' | 'file' {
    return this.useDatabase ? 'database' : 'file';
  }

  /**
   * Get file storage location (only relevant when in file mode)
   */
  getFileStorageLocation(): 'local' | 'cloud' | null {
    if (this.useDatabase) {
      return null;
    }
    return this.config.fileStorageLocation ?? 'local';
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
    // Hierarchical file storage doesn't need initialization
  }

  /**
   * Close the storage adapter
   */
  async close(): Promise<void> {
    if (this.useDatabase && this.sqliteStorage) {
      await this.sqliteStorage.close();
    }
    // Hierarchical file storage doesn't need explicit closing
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
      if (
        this.useDatabase &&
        this.sqliteStorage &&
        'healthCheck' in this.sqliteStorage
      ) {
        return this.sqliteStorage.healthCheck();
      }

      // For hierarchical file storage, just check if we can access the storage
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

    // Hierarchical file storage doesn't provide detailed stats yet
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

    // Hierarchical file storage doesn't need optimization
  }
}
