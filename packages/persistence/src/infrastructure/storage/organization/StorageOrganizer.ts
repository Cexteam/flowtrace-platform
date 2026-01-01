/**
 * Storage Organizer
 * Manages storage organization including exchange-based partitioning,
 * file count optimization, and directory structure management.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface StorageOrganizationConfig {
  /** Base directory for storage */
  baseDir: string;

  /** Organize by exchange (default: false) */
  organizeByExchange: boolean;

  /** Maximum database file size in bytes (default: 10GB) */
  maxDatabaseSize?: number;

  /** Symbol count threshold for exchange partitioning (default: 100) */
  exchangePartitionThreshold?: number;
}

export interface StorageStats {
  /** Total number of database files */
  fileCount: number;

  /** Total storage size in bytes */
  totalSize: number;

  /** Size per exchange (if organized by exchange) */
  sizeByExchange: Map<string, number>;

  /** Number of symbols per exchange */
  symbolsByExchange: Map<string, number>;

  /** List of database file paths */
  databaseFiles: string[];
}

export interface PartitionInfo {
  /** Exchange name */
  exchange: string;

  /** Database file path */
  databasePath: string;

  /** Current size in bytes */
  currentSize: number;

  /** Number of symbols */
  symbolCount: number;

  /** Whether partition needs splitting */
  needsSplit: boolean;
}

/**
 * Storage Organizer
 * Handles storage organization strategies including:
 * - Exchange-based database partitioning
 * - Automatic file count optimization
 * - Directory structure management
 * - Database size monitoring
 */
export class StorageOrganizer {
  private config: Required<StorageOrganizationConfig>;
  private symbolRegistry: Map<string, Set<string>> = new Map(); // exchange -> symbols

  constructor(config: StorageOrganizationConfig) {
    this.config = {
      baseDir: config.baseDir,
      organizeByExchange: config.organizeByExchange,
      maxDatabaseSize: config.maxDatabaseSize ?? 10 * 1024 * 1024 * 1024, // 10GB
      exchangePartitionThreshold: config.exchangePartitionThreshold ?? 100,
    };
  }

  /**
   * Initialize storage directory structure
   */
  async initialize(): Promise<void> {
    // Ensure base directory exists
    if (!fs.existsSync(this.config.baseDir)) {
      fs.mkdirSync(this.config.baseDir, { recursive: true });
    }

    // Scan existing structure
    await this.scanExistingStructure();
  }

  /**
   * Scan existing storage structure
   */
  private async scanExistingStructure(): Promise<void> {
    if (!fs.existsSync(this.config.baseDir)) {
      return;
    }

    const entries = fs.readdirSync(this.config.baseDir, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Check if it's an exchange directory
        const exchangeDir = path.join(this.config.baseDir, entry.name);
        const dbPath = path.join(exchangeDir, 'candles.db');

        if (fs.existsSync(dbPath)) {
          // Register exchange
          if (!this.symbolRegistry.has(entry.name)) {
            this.symbolRegistry.set(entry.name, new Set());
          }
        }
      } else if (entry.name === 'flowtrace-candles.db') {
        // Single database mode
        if (!this.symbolRegistry.has('default')) {
          this.symbolRegistry.set('default', new Set());
        }
      }
    }
  }

  /**
   * Get database path for a given exchange
   */
  getDatabasePath(exchange: string): string {
    if (this.config.organizeByExchange) {
      return path.join(this.config.baseDir, exchange, 'candles.db');
    } else {
      return path.join(this.config.baseDir, 'flowtrace-candles.db');
    }
  }

  /**
   * Get all database paths
   */
  getAllDatabasePaths(): string[] {
    const paths: string[] = [];

    if (this.config.organizeByExchange) {
      for (const exchange of this.symbolRegistry.keys()) {
        if (exchange !== 'default') {
          paths.push(this.getDatabasePath(exchange));
        }
      }
    } else {
      const defaultPath = this.getDatabasePath('default');
      if (fs.existsSync(defaultPath)) {
        paths.push(defaultPath);
      }
    }

    return paths;
  }

  /**
   * Register a symbol for an exchange
   */
  registerSymbol(exchange: string, symbol: string): void {
    if (!this.symbolRegistry.has(exchange)) {
      this.symbolRegistry.set(exchange, new Set());
    }
    this.symbolRegistry.get(exchange)!.add(symbol);
  }

  /**
   * Get total symbol count
   */
  getTotalSymbolCount(): number {
    let total = 0;
    for (const symbols of this.symbolRegistry.values()) {
      total += symbols.size;
    }
    return total;
  }

  /**
   * Get symbol count for an exchange
   */
  getSymbolCount(exchange: string): number {
    return this.symbolRegistry.get(exchange)?.size ?? 0;
  }

  /**
   * Get all registered exchanges
   */
  getExchanges(): string[] {
    return Array.from(this.symbolRegistry.keys()).filter(
      (e) => e !== 'default'
    );
  }

  /**
   * Determine optimal storage mode based on symbol count
   */
  determineStorageMode(): 'single' | 'partitioned' {
    const totalSymbols = this.getTotalSymbolCount();
    const exchangeCount = this.getExchanges().length;

    // Use partitioned mode if:
    // 1. Total symbols exceed threshold, OR
    // 2. Multiple exchanges with significant symbols each
    if (totalSymbols >= this.config.exchangePartitionThreshold) {
      return 'partitioned';
    }

    if (exchangeCount > 1) {
      // Check if any exchange has significant symbols
      for (const exchange of this.getExchanges()) {
        if (this.getSymbolCount(exchange) > 20) {
          return 'partitioned';
        }
      }
    }

    return 'single';
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    const stats: StorageStats = {
      fileCount: 0,
      totalSize: 0,
      sizeByExchange: new Map(),
      symbolsByExchange: new Map(),
      databaseFiles: [],
    };

    // Scan database files
    if (this.config.organizeByExchange) {
      for (const exchange of this.symbolRegistry.keys()) {
        if (exchange === 'default') continue;

        const dbPath = this.getDatabasePath(exchange);
        if (fs.existsSync(dbPath)) {
          const fileStats = fs.statSync(dbPath);
          stats.fileCount++;
          stats.totalSize += fileStats.size;
          stats.sizeByExchange.set(exchange, fileStats.size);
          stats.databaseFiles.push(dbPath);
        }

        stats.symbolsByExchange.set(exchange, this.getSymbolCount(exchange));
      }
    } else {
      const dbPath = this.getDatabasePath('default');
      if (fs.existsSync(dbPath)) {
        const fileStats = fs.statSync(dbPath);
        stats.fileCount = 1;
        stats.totalSize = fileStats.size;
        stats.sizeByExchange.set('default', fileStats.size);
        stats.databaseFiles.push(dbPath);
      }

      stats.symbolsByExchange.set('default', this.getTotalSymbolCount());
    }

    return stats;
  }

  /**
   * Get file count (bounded by max(10, exchangeCount))
   */
  async getFileCount(): Promise<number> {
    const stats = await this.getStats();
    return stats.fileCount;
  }

  /**
   * Calculate expected maximum file count
   */
  getExpectedMaxFileCount(): number {
    if (!this.config.organizeByExchange) {
      return 1;
    }

    const exchangeCount = this.getExchanges().length;
    return Math.max(10, exchangeCount);
  }

  /**
   * Check if file count is within bounds
   */
  async isFileCountOptimal(): Promise<boolean> {
    const fileCount = await this.getFileCount();
    const maxExpected = this.getExpectedMaxFileCount();
    return fileCount <= maxExpected;
  }

  /**
   * Get partition info for all exchanges
   */
  async getPartitionInfo(): Promise<PartitionInfo[]> {
    const partitions: PartitionInfo[] = [];

    if (this.config.organizeByExchange) {
      for (const exchange of this.symbolRegistry.keys()) {
        if (exchange === 'default') continue;

        const dbPath = this.getDatabasePath(exchange);
        let currentSize = 0;

        if (fs.existsSync(dbPath)) {
          const fileStats = fs.statSync(dbPath);
          currentSize = fileStats.size;
        }

        partitions.push({
          exchange,
          databasePath: dbPath,
          currentSize,
          symbolCount: this.getSymbolCount(exchange),
          needsSplit: currentSize > this.config.maxDatabaseSize,
        });
      }
    } else {
      const dbPath = this.getDatabasePath('default');
      let currentSize = 0;

      if (fs.existsSync(dbPath)) {
        const fileStats = fs.statSync(dbPath);
        currentSize = fileStats.size;
      }

      partitions.push({
        exchange: 'default',
        databasePath: dbPath,
        currentSize,
        symbolCount: this.getTotalSymbolCount(),
        needsSplit: currentSize > this.config.maxDatabaseSize,
      });
    }

    return partitions;
  }

  /**
   * Ensure exchange directory exists
   */
  ensureExchangeDirectory(exchange: string): string {
    if (!this.config.organizeByExchange) {
      return this.config.baseDir;
    }

    const exchangeDir = path.join(this.config.baseDir, exchange);
    if (!fs.existsSync(exchangeDir)) {
      fs.mkdirSync(exchangeDir, { recursive: true });
    }

    return exchangeDir;
  }

  /**
   * Check if database size is within limits
   */
  async isDatabaseSizeWithinLimits(exchange?: string): Promise<boolean> {
    const dbPath = exchange
      ? this.getDatabasePath(exchange)
      : this.getDatabasePath('default');

    if (!fs.existsSync(dbPath)) {
      return true;
    }

    const fileStats = fs.statSync(dbPath);
    return fileStats.size <= this.config.maxDatabaseSize;
  }

  /**
   * Get database size in bytes
   */
  getDatabaseSize(exchange?: string): number {
    const dbPath = exchange
      ? this.getDatabasePath(exchange)
      : this.getDatabasePath('default');

    if (!fs.existsSync(dbPath)) {
      return 0;
    }

    const fileStats = fs.statSync(dbPath);
    return fileStats.size;
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<Required<StorageOrganizationConfig>> {
    return { ...this.config };
  }

  /**
   * Clean up empty exchange directories
   */
  async cleanupEmptyDirectories(): Promise<void> {
    if (!this.config.organizeByExchange) {
      return;
    }

    const entries = fs.readdirSync(this.config.baseDir, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = path.join(this.config.baseDir, entry.name);
        const files = fs.readdirSync(dirPath);

        if (files.length === 0) {
          fs.rmdirSync(dirPath);
          this.symbolRegistry.delete(entry.name);
        }
      }
    }
  }
}
