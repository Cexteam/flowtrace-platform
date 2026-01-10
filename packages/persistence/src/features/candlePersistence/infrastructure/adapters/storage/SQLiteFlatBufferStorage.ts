/**
 * SQLite FlatBuffer Storage
 * Implements CandleStoragePort interface using SQLite database with FlatBuffer + LZ4 serialization.
 * Provides high-performance storage with concurrent access and efficient querying.
 * This adapter is a thin wrapper that delegates to shared infrastructure components:
 * - ConnectionManager: Database connection management
 * - SchemaManager: Schema creation and migration
 * - IndexManager: Index management and optimization
 * - CompressedCandleSerializerPort: Candle serialization/deserialization (FlatBuffer + LZ4)
 * - QueryBuilder: SQL query construction
 */

import type { FootprintCandle } from '@flowtrace/core';
import type { CandleStoragePort } from '../../../application/ports/out/CandleStoragePort.js';
import type { CompressedCandleSerializerPort } from '../../../application/ports/out/CompressedCandleSerializerPort.js';
import { ConnectionManager } from '../../../../../infrastructure/storage/sqlite/connection/ConnectionManager.js';
import type { ConnectionConfig } from '../../../../../infrastructure/storage/sqlite/connection/ConnectionManager.js';
import { SchemaManager } from '../../../../../infrastructure/storage/sqlite/schema/SchemaManager.js';
import { IndexManager } from '../../../../../infrastructure/storage/sqlite/indexing/IndexManager.js';
import { QueryBuilder } from '../../../../../infrastructure/storage/sqlite/query/QueryBuilder.js';
import * as path from 'path';

export interface SQLiteStorageConfig {
  /** Base directory for database files */
  baseDir: string;
  /** Organize databases by exchange (default: false) */
  organizeByExchange?: boolean;
  /** Maximum candles per batch operation (default: 1000) */
  maxCandlesPerBatch?: number;
  /** Enable WAL mode (default: true) */
  walMode?: boolean;
  /** Cache size in KB (default: 64MB) */
  cacheSize?: number;
  /** Memory-mapped I/O size in bytes (default: 256MB) */
  mmapSize?: number;
  /** Compressed candle serializer (optional - uses default if not provided) */
  serializer?: CompressedCandleSerializerPort;
}

/**
 * Query options for advanced filtering
 */
export interface QueryFilter {
  /** Symbol filter (exact match or array for IN clause) */
  symbols?: string | string[];
  /** Exchange filter */
  exchange?: string;
  /** Timeframe filter */
  timeframe?: string;
  /** Start time (inclusive) */
  startTime?: number;
  /** End time (inclusive) */
  endTime?: number;
  /** Result limit */
  limit?: number;
  /** Result offset for pagination */
  offset?: number;
  /** Sort order */
  orderBy?: 'asc' | 'desc';
}

/**
 * Aggregation result type
 */
export interface AggregationResult {
  symbol?: string;
  exchange?: string;
  timeframe?: string;
  count: number;
  earliestTime: number;
  latestTime: number;
}

/**
 * Query performance metrics
 */
export interface QueryMetrics {
  /** Query execution time in milliseconds */
  executionTimeMs: number;
}

/**
 * Storage summary statistics
 */
export interface StorageSummary {
  totalCandles: number;
  uniqueSymbols: number;
  uniqueExchanges: number;
  uniqueTimeframes: number;
  earliestCandle: number | null;
  latestCandle: number | null;
}

/**
 * SQLite FlatBuffer Storage Implementation
 * High-performance candle storage using SQLite database with FlatBuffer + LZ4 serialization.
 * Delegates to shared infrastructure components for all operations.
 */
export class SQLiteFlatBufferStorage implements CandleStoragePort {
  private config: Required<Omit<SQLiteStorageConfig, 'serializer'>>;
  private serializer?: CompressedCandleSerializerPort;
  private connectionManagers: Map<string, ConnectionManager> = new Map();
  private schemaManagers: Map<string, SchemaManager> = new Map();
  private indexManagers: Map<string, IndexManager> = new Map();
  private queryBuilders: Map<string, QueryBuilder> = new Map();
  private isInitialized = false;

  constructor(config: SQLiteStorageConfig) {
    this.config = {
      baseDir: config.baseDir,
      organizeByExchange: config.organizeByExchange ?? false,
      maxCandlesPerBatch: config.maxCandlesPerBatch ?? 1000,
      walMode: config.walMode ?? true,
      cacheSize: config.cacheSize ?? 65536, // 64MB
      mmapSize: config.mmapSize ?? 268435456, // 256MB
    };
    this.serializer = config.serializer;
  }

  /**
   * Set the compressed candle serializer
   * Can be called after construction to inject the serializer
   */
  setSerializer(serializer: CompressedCandleSerializerPort): void {
    this.serializer = serializer;
  }

  /**
   * Initialize storage and create database connections
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      if (this.config.organizeByExchange) {
        // Initialize with empty managers map - will be created on demand
      } else {
        // Create single database
        await this.initializeDatabase('default');
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize SQLite storage:', error);
      throw error;
    }
  }

  /**
   * Initialize a database for a specific key (exchange or 'default')
   */
  private async initializeDatabase(key: string): Promise<void> {
    const dbPath = this.getDatabasePath(key);
    const tableName = this.getTableName(key === 'default' ? '' : key);

    const connectionConfig: ConnectionConfig = {
      filePath: dbPath,
      walMode: this.config.walMode,
      cacheSize: this.config.cacheSize,
      mmapSize: this.config.mmapSize,
    };

    // Create connection manager (delegates to shared component)
    const connectionManager = new ConnectionManager(connectionConfig);
    await connectionManager.initialize();

    // Create schema manager and initialize schema
    const schemaManager = new SchemaManager(connectionManager);

    // For exchange-specific databases, create exchange table (includes indexes)
    // For default database, create standard schema and indexes
    if (this.config.organizeByExchange && key !== 'default') {
      await schemaManager.createExchangeTable(key);
      // Note: createExchangeTable already creates indexes, so skip IndexManager
    } else {
      await schemaManager.createSchema();
      // Create index manager and create indexes for default schema
      const indexManager = new IndexManager(connectionManager);
      await indexManager.createIndexes();
      this.indexManagers.set(key, indexManager);
    }

    // Create query builder for this database
    const queryBuilder = new QueryBuilder(tableName);

    // Store managers
    this.connectionManagers.set(key, connectionManager);
    this.schemaManagers.set(key, schemaManager);
    this.queryBuilders.set(key, queryBuilder);
  }

  /**
   * Get database path for a key
   */
  private getDatabasePath(key: string): string {
    if (key === 'default') {
      return path.join(this.config.baseDir, 'flowtrace-candles.db');
    } else {
      return path.join(this.config.baseDir, key, 'candles.db');
    }
  }

  /**
   * Get database key for exchange
   */
  private getDatabaseKey(exchange: string): string {
    return this.config.organizeByExchange ? exchange : 'default';
  }

  /**
   * Get connection manager for exchange
   */
  private async getConnectionManager(
    exchange: string
  ): Promise<ConnectionManager> {
    const key = this.getDatabaseKey(exchange);

    if (!this.connectionManagers.has(key)) {
      await this.initializeDatabase(key);
    }

    const connectionManager = this.connectionManagers.get(key);
    if (!connectionManager) {
      throw new Error(`Connection manager not found for key: ${key}`);
    }

    return connectionManager;
  }

  /**
   * Get query builder for exchange
   */
  private async getQueryBuilder(exchange: string): Promise<QueryBuilder> {
    const key = this.getDatabaseKey(exchange);

    if (!this.queryBuilders.has(key)) {
      await this.initializeDatabase(key);
    }

    const queryBuilder = this.queryBuilders.get(key);
    if (!queryBuilder) {
      throw new Error(`Query builder not found for key: ${key}`);
    }

    return queryBuilder;
  }

  /**
   * Get table name for exchange
   */
  private getTableName(exchange: string): string {
    return this.config.organizeByExchange && exchange
      ? `${exchange}_candles`
      : 'candles';
  }

  /**
   * Generate candle ID
   */
  private generateCandleId(candle: FootprintCandle): string {
    return `${candle.ex}:${candle.s}:${candle.i}:${candle.t}`;
  }

  /**
   * Serialize candle using CompressedCandleSerializerPort (FlatBuffer + LZ4)
   */
  private serializeCandle(candle: FootprintCandle): Buffer {
    if (!this.serializer) {
      throw new Error(
        'CompressedCandleSerializerPort not configured. Call setSerializer() first.'
      );
    }
    const result = this.serializer.serialize(candle);
    return result.buffer;
  }

  /**
   * Deserialize candle using CompressedCandleSerializerPort (LZ4 + FlatBuffer)
   */
  private deserializeCandle(buffer: Buffer): FootprintCandle {
    if (!this.serializer) {
      throw new Error(
        'CompressedCandleSerializerPort not configured. Call setSerializer() first.'
      );
    }
    const result = this.serializer.deserialize(buffer);
    return result.candle;
  }

  // ============================================================================
  // CandleStoragePort Interface Implementation
  // ============================================================================

  /**
   * Save a single candle to storage
   */
  async save(candle: FootprintCandle): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const connectionManager = await this.getConnectionManager(candle.ex);
    const queryBuilder = await this.getQueryBuilder(candle.ex);
    const candleId = this.generateCandleId(candle);
    const serializedData = this.serializeCandle(candle);
    const now = Date.now();

    try {
      // Use QueryBuilder to build the upsert query
      const upsertSql = queryBuilder.buildUpsertQuery();
      const stmt = connectionManager.prepare(upsertSql);

      stmt.run({
        id: candleId,
        symbol: candle.s,
        exchange: candle.ex,
        timeframe: candle.i,
        open_time: candle.t,
        close_time: candle.ct,
        data: serializedData,
        created_at: now,
        updated_at: now,
      });
    } catch (error) {
      console.error(`Failed to save candle ${candleId}:`, error);
      throw error;
    }
  }

  /**
   * Save multiple candles to storage (batch operation)
   */
  async saveMany(candles: FootprintCandle[]): Promise<void> {
    if (candles.length === 0) return;

    if (!this.isInitialized) {
      await this.initialize();
    }

    // Group candles by exchange
    const candlesByExchange = new Map<string, FootprintCandle[]>();
    for (const candle of candles) {
      const exchange = candle.ex;
      if (!candlesByExchange.has(exchange)) {
        candlesByExchange.set(exchange, []);
      }
      candlesByExchange.get(exchange)!.push(candle);
    }

    // Process each exchange separately
    for (const [exchange, exchangeCandles] of candlesByExchange) {
      await this.saveManyForExchange(exchange, exchangeCandles);
    }
  }

  /**
   * Save multiple candles for a specific exchange
   */
  private async saveManyForExchange(
    exchange: string,
    candles: FootprintCandle[]
  ): Promise<void> {
    const connectionManager = await this.getConnectionManager(exchange);
    const queryBuilder = await this.getQueryBuilder(exchange);
    const now = Date.now();

    try {
      // Use QueryBuilder to build the upsert query
      const upsertSql = queryBuilder.buildUpsertQuery();
      const stmt = connectionManager.prepare(upsertSql);

      // Process in batches to avoid memory issues
      const batchSize = this.config.maxCandlesPerBatch;

      for (let i = 0; i < candles.length; i += batchSize) {
        const batch = candles.slice(i, i + batchSize);

        const db = connectionManager.getConnection();
        const insertMany = db.transaction((candleBatch: FootprintCandle[]) => {
          for (const candle of candleBatch) {
            const candleId = this.generateCandleId(candle);
            const serializedData = this.serializeCandle(candle);

            stmt.run({
              id: candleId,
              symbol: candle.s,
              exchange: candle.ex,
              timeframe: candle.i,
              open_time: candle.t,
              close_time: candle.ct,
              data: serializedData,
              created_at: now,
              updated_at: now,
            });
          }
        });

        insertMany(batch);
      }
    } catch (error) {
      console.error(`Failed to save candles for ${exchange}:`, error);
      throw error;
    }
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
    if (!this.isInitialized) {
      await this.initialize();
    }

    const connectionManager = await this.getConnectionManager(exchange);
    const queryBuilder = await this.getQueryBuilder(exchange);

    try {
      // Use QueryBuilder to build the query
      const { sql, params } = queryBuilder.buildFindBySymbolQuery({
        startTime: options?.startTime,
        endTime: options?.endTime,
        limit: options?.limit,
      });

      const stmt = connectionManager.prepare(sql);
      const rows = stmt.all({
        ...params,
        symbol,
        exchange,
        timeframe,
      }) as Array<{ data: Buffer }>;

      // Deserialize candles using FlatBufferSerializer
      const candles: FootprintCandle[] = [];
      for (const row of rows) {
        try {
          const candle = this.deserializeCandle(row.data);
          candles.push(candle);
        } catch (error) {
          console.error('Failed to deserialize candle:', error);
          // Continue with other candles
        }
      }

      return candles;
    } catch (error) {
      console.error(`Failed to find candles for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Find the latest candle for a symbol
   */
  async findLatest(
    symbol: string,
    exchange: string,
    timeframe: string
  ): Promise<FootprintCandle | null> {
    const candles = await this.findBySymbol(symbol, exchange, timeframe, {
      limit: 1,
    });
    return candles.length > 0 ? candles[0] ?? null : null;
  }

  /**
   * Flush any pending operations (no-op for SQLite with immediate writes)
   */
  async flush(): Promise<void> {
    // SQLite writes are immediate, but we can perform checkpoints
    for (const [key, connectionManager] of this.connectionManagers) {
      try {
        await connectionManager.checkpoint();
      } catch (error) {
        console.error(`Failed to checkpoint database ${key}:`, error);
      }
    }
  }

  // ============================================================================
  // Additional Methods
  // ============================================================================

  /**
   * Get storage statistics
   */
  async getStats(): Promise<Map<string, any>> {
    const stats = new Map<string, any>();

    for (const [key, connectionManager] of this.connectionManagers) {
      try {
        const dbStats = await connectionManager.getStats();
        stats.set(key, dbStats);
      } catch (error) {
        console.error(`Failed to get stats for database ${key}:`, error);
      }
    }

    return stats;
  }

  /**
   * Optimize all databases
   */
  async optimize(): Promise<void> {
    for (const [key, connectionManager] of this.connectionManagers) {
      try {
        await connectionManager.optimize();

        const indexManager = this.indexManagers.get(key);
        if (indexManager) {
          await indexManager.optimizeIndexes();
        }
      } catch (error) {
        console.error(`Failed to optimize database ${key}:`, error);
      }
    }
  }

  /**
   * Close all database connections
   */
  async close(): Promise<void> {
    for (const [key, connectionManager] of this.connectionManagers) {
      try {
        await connectionManager.close();
      } catch (error) {
        console.error(`Failed to close database ${key}:`, error);
      }
    }

    this.connectionManagers.clear();
    this.schemaManagers.clear();
    this.indexManagers.clear();
    this.queryBuilders.clear();
    this.isInitialized = false;
  }

  /**
   * Health check for all databases
   */
  async healthCheck(): Promise<boolean> {
    for (const [key, connectionManager] of this.connectionManagers) {
      const isHealthy = await connectionManager.healthCheck();
      if (!isHealthy) {
        console.error(`Database ${key} failed health check`);
        return false;
      }
    }

    return true;
  }

  // ============================================================================
  // Enhanced Query Capabilities
  // ============================================================================

  /**
   * Find candles with advanced filtering using SQL WHERE clauses
   */
  async findWithFilter(filter: {
    symbols?: string | string[];
    exchange?: string;
    timeframe?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
    offset?: number;
    orderBy?: 'asc' | 'desc';
  }): Promise<FootprintCandle[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const exchange = filter.exchange || 'default';
    const connectionManager = await this.getConnectionManager(exchange);
    const queryBuilder = await this.getQueryBuilder(exchange);

    try {
      // Delegate query building to QueryBuilder
      const { sql, params } = queryBuilder.buildSelectQuery(['data'], {
        symbols: filter.symbols,
        exchange: filter.exchange,
        timeframe: filter.timeframe,
        startTime: filter.startTime,
        endTime: filter.endTime,
        limit: filter.limit,
        offset: filter.offset,
        orderBy: filter.orderBy,
      });

      const stmt = connectionManager.prepare(sql);
      const rows = stmt.all(params) as Array<{ data: Buffer }>;

      // Deserialize candles using FlatBufferSerializer
      const candles: FootprintCandle[] = [];
      for (const row of rows) {
        try {
          const candle = this.deserializeCandle(row.data);
          candles.push(candle);
        } catch (error) {
          console.error('Failed to deserialize candle:', error);
        }
      }

      return candles;
    } catch (error) {
      console.error('Failed to execute filtered query:', error);
      throw error;
    }
  }

  /**
   * Execute aggregation query with GROUP BY
   */
  async aggregate(
    groupBy: ('symbol' | 'exchange' | 'timeframe')[],
    options?: {
      exchange?: string;
      filter?: {
        symbols?: string[];
        startTime?: number;
        endTime?: number;
      };
      having?: {
        minCount?: number;
      };
    }
  ): Promise<
    Array<{
      symbol?: string;
      exchange?: string;
      timeframe?: string;
      count: number;
      earliestTime: number;
      latestTime: number;
    }>
  > {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const exchange = options?.exchange || 'default';
    const connectionManager = await this.getConnectionManager(exchange);
    const queryBuilder = await this.getQueryBuilder(exchange);

    try {
      // Delegate query building to QueryBuilder
      const { sql, params } = queryBuilder.buildAggregationQuery({
        groupBy,
        filter: options?.filter,
        having: options?.having,
      });

      const stmt = connectionManager.prepare(sql);
      const rows = stmt.all(params) as Array<{
        symbol?: string;
        exchange?: string;
        timeframe?: string;
        count: number;
        earliestTime: number;
        latestTime: number;
      }>;

      return rows;
    } catch (error) {
      console.error('Failed to execute aggregation query:', error);
      throw error;
    }
  }

  /**
   * Query across multiple symbols in a single operation
   */
  async findCrossSymbol(options: {
    exchange?: string;
    timeframe?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): Promise<Map<string, FootprintCandle[]>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const exchange = options.exchange || 'default';
    const connectionManager = await this.getConnectionManager(exchange);
    const queryBuilder = await this.getQueryBuilder(exchange);

    try {
      // Delegate query building to QueryBuilder
      const { sql, params } = queryBuilder.buildCrossSymbolQuery({
        exchange: options.exchange,
        timeframe: options.timeframe,
        startTime: options.startTime,
        endTime: options.endTime,
        limit: options.limit,
      });

      const stmt = connectionManager.prepare(sql);
      const rows = stmt.all(params) as Array<{ symbol: string; data: Buffer }>;

      const result = new Map<string, FootprintCandle[]>();

      for (const row of rows) {
        try {
          const candle = this.deserializeCandle(row.data);
          if (!result.has(row.symbol)) {
            result.set(row.symbol, []);
          }
          result.get(row.symbol)!.push(candle);
        } catch (error) {
          console.error(
            `Failed to deserialize candle for ${row.symbol}:`,
            error
          );
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to execute cross-symbol query:', error);
      throw error;
    }
  }

  /**
   * List all unique symbols in storage
   */
  async listSymbols(options?: {
    exchange?: string;
    timeframe?: string;
  }): Promise<string[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const exchange = options?.exchange || 'default';
    const connectionManager = await this.getConnectionManager(exchange);
    const queryBuilder = await this.getQueryBuilder(exchange);

    try {
      // Delegate query building to QueryBuilder
      const { sql, params } = queryBuilder.buildListSymbolsQuery({
        exchange: options?.exchange,
        timeframe: options?.timeframe,
      });

      const stmt = connectionManager.prepare(sql);
      const rows = stmt.all(params) as Array<{ symbol: string }>;
      return rows.map((row) => row.symbol);
    } catch (error) {
      console.error('Failed to list symbols:', error);
      throw error;
    }
  }

  /**
   * Get storage summary statistics
   */
  async getStorageSummary(exchange?: string): Promise<{
    totalCandles: number;
    uniqueSymbols: number;
    uniqueExchanges: number;
    uniqueTimeframes: number;
    earliestCandle: number | null;
    latestCandle: number | null;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const connectionManager = await this.getConnectionManager(
      exchange || 'default'
    );
    const queryBuilder = await this.getQueryBuilder(exchange || 'default');

    try {
      // Delegate query building to QueryBuilder
      const { sql, params } = queryBuilder.buildStorageSummaryQuery();

      const stmt = connectionManager.prepare(sql);
      const result = stmt.get(params) as {
        totalCandles: number;
        uniqueSymbols: number;
        uniqueExchanges: number;
        uniqueTimeframes: number;
        earliestCandle: number | null;
        latestCandle: number | null;
      };

      return result;
    } catch (error) {
      console.error('Failed to get storage summary:', error);
      throw error;
    }
  }

  /**
   * Execute query with performance monitoring
   */
  async queryWithMetrics<T>(
    queryFn: () => Promise<T>
  ): Promise<{ result: T; metrics: { executionTimeMs: number } }> {
    const startTime = process.hrtime.bigint();

    const result = await queryFn();

    const endTime = process.hrtime.bigint();
    const executionTimeMs = Number(endTime - startTime) / 1000000;

    return {
      result,
      metrics: {
        executionTimeMs,
      },
    };
  }
}
