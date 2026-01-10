/**
 * ReadOnlyCandleStorage
 * Read-only adapter implementing CandleReaderPort interface.
 * Opens SQLite database in read-only mode for safe concurrent access.
 * Uses FlatBuffer + LZ4 deserialization for efficient data retrieval.
 *
 * @module @flowtrace/persistence
 */

import Database from 'better-sqlite3';
import type {
  CandleReaderPort,
  FootprintCandleResult,
} from '../../../application/ports/in/CandleReaderPort.js';
import { CompressedCandleSerializerAdapter } from '../serialization/CompressedCandleSerializerAdapter.js';
import * as fs from 'fs';

/**
 * Configuration for ReadOnlyCandleStorage
 */
export interface ReadOnlyCandleStorageConfig {
  /** Path to SQLite database file */
  dbPath: string;
  /** Exchange name for table naming (default: extracted from dbPath) */
  exchange?: string;
  /** Cache size in KB (default: 32MB) */
  cacheSize?: number;
}

/**
 * ReadOnlyCandleStorage
 * Implements CandleReaderPort with read-only SQLite connection.
 * Provides safe concurrent access to candle data without risk of writes.
 */
export class ReadOnlyCandleStorage implements CandleReaderPort {
  private db: Database.Database | null = null;
  private isClosed = false;
  private readonly config: Required<ReadOnlyCandleStorageConfig>;
  private readonly tableName: string;
  private readonly serializer: CompressedCandleSerializerAdapter;

  constructor(config: ReadOnlyCandleStorageConfig) {
    // Extract exchange from dbPath if not provided
    // e.g., /path/to/candles/binance/candles.db -> binance
    const exchange =
      config.exchange || this.extractExchangeFromPath(config.dbPath);

    this.config = {
      dbPath: config.dbPath,
      exchange,
      cacheSize: config.cacheSize ?? 32768, // 32MB default
    };

    // Use exchange-based table name (e.g., binance_candles)
    this.tableName = `${this.config.exchange}_candles`;

    // Initialize serializer for FTCF format (FlatBuffer + LZ4)
    this.serializer = new CompressedCandleSerializerAdapter();

    this.initialize();
  }

  /**
   * Extract exchange name from database path
   * e.g., /path/to/candles/binance/candles.db -> binance
   */
  private extractExchangeFromPath(dbPath: string): string {
    const parts = dbPath.split('/');
    // Find the parent directory of candles.db
    const dbIndex = parts.findIndex((p) => p === 'candles.db');
    if (dbIndex > 0) {
      return parts[dbIndex - 1] || 'binance';
    }
    // Fallback: look for known exchange names
    const knownExchanges = ['binance', 'bybit', 'okx', 'coinbase', 'kraken'];
    for (const exchange of knownExchanges) {
      if (dbPath.includes(`/${exchange}/`)) {
        return exchange;
      }
    }
    return 'binance'; // Default fallback
  }

  /**
   * Initialize read-only database connection
   */
  private initialize(): void {
    // Validate database file exists
    if (!fs.existsSync(this.config.dbPath)) {
      throw new Error(`Database file not found: ${this.config.dbPath}`);
    }

    try {
      // Open database in read-only mode
      this.db = new Database(this.config.dbPath, {
        readonly: true,
        fileMustExist: true,
      });

      // Configure pragmas for read-only access
      this.configurePragmas();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Cannot open database: ${this.config.dbPath} - ${message}`
      );
    }
  }

  /**
   * Configure SQLite pragmas for optimal read performance
   */
  private configurePragmas(): void {
    if (!this.db) return;

    // WAL mode for concurrent access (read-only can still benefit)
    this.db.pragma('journal_mode = WAL');

    // Cache size (negative value means KB)
    this.db.pragma(`cache_size = -${this.config.cacheSize}`);

    // Memory-mapped I/O for faster reads
    this.db.pragma('mmap_size = 268435456'); // 256MB

    // Query only mode optimizations
    this.db.pragma('query_only = ON');
    this.db.pragma('temp_store = MEMORY');
  }

  /**
   * Ensure database is open and ready
   */
  private ensureOpen(): Database.Database {
    if (this.isClosed || !this.db) {
      throw new Error('Reader is closed');
    }
    return this.db;
  }

  /**
   * Deserialize FTCF buffer to FootprintCandleResult
   * FTCF format: Magic bytes (FTCF) + LZ4 compressed FlatBuffer
   */
  private deserializeCandle(buffer: Buffer): FootprintCandleResult | null {
    try {
      // Use CompressedCandleSerializerAdapter for FTCF format
      const result = this.serializer.deserialize(buffer);
      const candleData = result.candle;

      // Convert to FootprintCandleResult format
      return {
        e: candleData.e || 'CANDLESTICK',
        ex: candleData.ex || '',
        s: candleData.s || '',
        i: candleData.i || '',
        t: candleData.t || 0,
        ct: candleData.ct || 0,
        o: candleData.o || 0,
        h: candleData.h || 0,
        l: candleData.l || 0,
        c: candleData.c || 0,
        v: candleData.v || 0,
        bv: candleData.bv || 0,
        sv: candleData.sv || 0,
        q: candleData.q || 0,
        bq: candleData.bq || 0,
        sq: candleData.sq || 0,
        d: candleData.d || 0,
        dMax: candleData.dMax || 0,
        dMin: candleData.dMin || 0,
        n: candleData.n || 0,
        tv: candleData.tv || 0,
        f: candleData.f || 0,
        ls: candleData.ls || 0,
        x: candleData.x || false,
        aggs: (candleData.aggs || []).map((agg) => ({
          tp: agg.tp,
          v: agg.v,
          bv: agg.bv,
          sv: agg.sv,
          bq: agg.bq ?? 0,
          sq: agg.sq ?? 0,
        })),
      };
    } catch (error) {
      // Log warning and skip corrupted record (per Requirements 3.3)
      console.warn(
        'Failed to deserialize candle, skipping corrupted record:',
        error
      );
      return null;
    }
  }

  /**
   * Find candles by symbol, exchange, and timeframe
   *
   * @param symbol - Trading symbol
   * @param exchange - Exchange name
   * @param timeframe - Timeframe (e.g., '1m', '5m')
   * @param options - Query options
   * @returns Array of FootprintCandleResult
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
  ): Promise<FootprintCandleResult[]> {
    const db = this.ensureOpen();

    console.log('[ReadOnlyCandleStorage] findBySymbol called:', {
      symbol,
      exchange,
      timeframe,
      options,
      tableName: this.tableName,
      dbPath: this.config.dbPath,
    });

    // Build query with exchange-based table name
    const conditions: string[] = [
      'symbol = @symbol',
      'exchange = @exchange',
      'timeframe = @timeframe',
    ];
    const params: Record<string, unknown> = {
      symbol,
      exchange,
      timeframe,
    };

    if (options?.startTime !== undefined) {
      params.startTime = options.startTime;
      conditions.push('open_time >= @startTime');
    }

    if (options?.endTime !== undefined) {
      params.endTime = options.endTime;
      conditions.push('open_time <= @endTime');
    }

    let sql = `SELECT data FROM ${this.tableName} WHERE ${conditions.join(
      ' AND '
    )} ORDER BY open_time DESC`;

    if (options?.limit !== undefined) {
      sql += ` LIMIT ${options.limit}`;
    }

    console.log('[ReadOnlyCandleStorage] SQL:', sql);
    console.log('[ReadOnlyCandleStorage] Params:', params);

    const stmt = db.prepare(sql);
    const rows = stmt.all(params) as Array<{ data: Buffer }>;

    console.log('[ReadOnlyCandleStorage] Rows found:', rows.length);

    // Deserialize candles, skipping corrupted records
    const candles: FootprintCandleResult[] = [];
    for (const row of rows) {
      const candle = this.deserializeCandle(row.data);
      if (candle) {
        candles.push(candle);
      }
    }

    console.log(
      '[ReadOnlyCandleStorage] Deserialized candles:',
      candles.length
    );

    return candles;
  }

  /**
   * Find the latest candle for a symbol
   *
   * @param symbol - Trading symbol
   * @param exchange - Exchange name
   * @param timeframe - Timeframe (e.g., '1m', '5m')
   * @returns Latest FootprintCandleResult or null if not found
   */
  async findLatest(
    symbol: string,
    exchange: string,
    timeframe: string
  ): Promise<FootprintCandleResult | null> {
    const candles = await this.findBySymbol(symbol, exchange, timeframe, {
      limit: 1,
    });
    return candles.length > 0 ? candles[0] ?? null : null;
  }

  /**
   * Count candles for a symbol
   *
   * @param symbol - Trading symbol
   * @param exchange - Exchange name
   * @param timeframe - Timeframe (e.g., '1m', '5m')
   * @param options - Query options
   * @returns Number of candles
   */
  async count(
    symbol: string,
    exchange: string,
    timeframe: string,
    options?: {
      startTime?: number;
      endTime?: number;
    }
  ): Promise<number> {
    const db = this.ensureOpen();

    console.log('[ReadOnlyCandleStorage] count called:', {
      symbol,
      exchange,
      timeframe,
      options,
      tableName: this.tableName,
    });

    // Build count query with exchange-based table name
    const conditions: string[] = [
      'symbol = @symbol',
      'exchange = @exchange',
      'timeframe = @timeframe',
    ];
    const params: Record<string, unknown> = {
      symbol,
      exchange,
      timeframe,
    };

    if (options?.startTime !== undefined) {
      params.startTime = options.startTime;
      conditions.push('open_time >= @startTime');
    }

    if (options?.endTime !== undefined) {
      params.endTime = options.endTime;
      conditions.push('open_time <= @endTime');
    }

    const sql = `SELECT COUNT(*) as count FROM ${
      this.tableName
    } WHERE ${conditions.join(' AND ')}`;

    console.log('[ReadOnlyCandleStorage] Count SQL:', sql);
    console.log('[ReadOnlyCandleStorage] Count Params:', params);

    const stmt = db.prepare(sql);
    const result = stmt.get(params) as { count: number } | undefined;

    console.log('[ReadOnlyCandleStorage] Count result:', result?.count ?? 0);

    return result?.count ?? 0;
  }

  /**
   * Close the reader and release resources
   */
  async close(): Promise<void> {
    if (this.isClosed || !this.db) {
      return;
    }

    try {
      this.db.close();
      this.db = null;
      this.isClosed = true;
    } catch (error) {
      console.error('Failed to close database:', error);
      throw error;
    }
  }
}
