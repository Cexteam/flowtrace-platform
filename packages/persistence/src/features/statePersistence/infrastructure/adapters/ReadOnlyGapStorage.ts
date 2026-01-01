/**
 * ReadOnlyGapStorage
 * Read-only adapter for querying gap records from RuntimeDatabase.
 * Opens SQLite database in read-only mode for safe concurrent access.
 *
 * @module @flowtrace/persistence
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';

/**
 * Gap record from database
 */
export interface GapRecord {
  id: number;
  exchange: string;
  symbol: string;
  fromTradeId: number;
  toTradeId: number;
  gapSize: number;
  detectedAt: number;
  synced: boolean;
  syncedAt: number | null;
}

/**
 * Options for loading gaps
 */
export interface GapLoadOptions {
  symbol?: string;
  exchange?: string;
  syncedOnly?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Paginated gap response
 */
export interface PaginatedGapsResult {
  gaps: GapRecord[];
  totalCount: number;
}

/**
 * Configuration for ReadOnlyGapStorage
 */
export interface ReadOnlyGapStorageConfig {
  /** Path to RuntimeDatabase file (runtime.db) */
  dbPath: string;
  /** Cache size in KB (default: 8MB) */
  cacheSize?: number;
}

/**
 * GapReaderPort interface for read-only gap access
 */
export interface GapReaderPort {
  /**
   * Load gaps with optional filtering and pagination
   */
  loadGaps(options?: GapLoadOptions): Promise<PaginatedGapsResult>;

  /**
   * Count gaps by symbol
   */
  countBySymbol(symbol: string): Promise<number>;

  /**
   * Get gap statistics by exchange
   */
  getStatsByExchange(exchange: string): Promise<{
    totalGaps: number;
    totalMissingTrades: number;
    symbolsAffected: number;
    oldestGap: number | null;
    newestGap: number | null;
  }>;

  /**
   * Close the reader
   */
  close(): Promise<void>;
}

/**
 * ReadOnlyGapStorage
 * Implements GapReaderPort with read-only SQLite connection.
 */
export class ReadOnlyGapStorage implements GapReaderPort {
  private db: Database.Database | null = null;
  private isClosed = false;
  private readonly config: Required<ReadOnlyGapStorageConfig>;

  constructor(config: ReadOnlyGapStorageConfig) {
    this.config = {
      dbPath: config.dbPath,
      cacheSize: config.cacheSize ?? 8192, // 8MB default
    };
    this.initialize();
  }

  /**
   * Initialize read-only database connection
   */
  private initialize(): void {
    if (!fs.existsSync(this.config.dbPath)) {
      throw new Error(`Database file not found: ${this.config.dbPath}`);
    }

    try {
      this.db = new Database(this.config.dbPath, {
        readonly: true,
        fileMustExist: true,
      });

      // Configure pragmas for read-only access
      // Note: Don't set journal_mode in readonly mode - it will use existing mode
      this.db.pragma(`cache_size = -${this.config.cacheSize}`);
      this.db.pragma('query_only = ON');
      this.db.pragma('temp_store = MEMORY');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Cannot open database: ${this.config.dbPath} - ${message}`
      );
    }
  }

  /**
   * Ensure database is open
   */
  private ensureOpen(): Database.Database {
    if (this.isClosed || !this.db) {
      throw new Error('Reader is closed');
    }
    return this.db;
  }

  /**
   * Load gaps with optional filtering and pagination
   */
  async loadGaps(options?: GapLoadOptions): Promise<PaginatedGapsResult> {
    const db = this.ensureOpen();

    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (options?.exchange) {
      conditions.push('exchange = @exchange');
      params.exchange = options.exchange;
    }

    if (options?.symbol) {
      conditions.push('symbol = @symbol');
      params.symbol = options.symbol;
    }

    if (options?.syncedOnly !== undefined) {
      conditions.push('synced = @synced');
      params.synced = options.syncedOnly ? 1 : 0;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countSql = `SELECT COUNT(*) as count FROM gap_records ${whereClause}`;
    const countResult = db.prepare(countSql).get(params) as
      | { count: number }
      | undefined;
    const totalCount = countResult?.count ?? 0;

    // Get gaps with pagination
    let sql = `SELECT * FROM gap_records ${whereClause} ORDER BY detected_at DESC`;

    if (options?.limit !== undefined) {
      sql += ` LIMIT ${options.limit}`;
      if (options?.offset !== undefined) {
        sql += ` OFFSET ${options.offset}`;
      }
    }

    const rows = db.prepare(sql).all(params) as Array<{
      id: number;
      exchange: string;
      symbol: string;
      from_trade_id: number;
      to_trade_id: number;
      gap_size: number;
      detected_at: number;
      synced: number;
      synced_at: number | null;
    }>;

    const gaps: GapRecord[] = rows.map((row) => ({
      id: row.id,
      exchange: row.exchange,
      symbol: row.symbol,
      fromTradeId: row.from_trade_id,
      toTradeId: row.to_trade_id,
      gapSize: row.gap_size,
      detectedAt: row.detected_at,
      synced: row.synced === 1,
      syncedAt: row.synced_at,
    }));

    return { gaps, totalCount };
  }

  /**
   * Count gaps by symbol
   */
  async countBySymbol(symbol: string): Promise<number> {
    const db = this.ensureOpen();
    const sql = 'SELECT COUNT(*) as count FROM gap_records WHERE symbol = ?';
    const result = db.prepare(sql).get(symbol) as { count: number } | undefined;
    return result?.count ?? 0;
  }

  /**
   * Get gap statistics by exchange
   * Note: Since gap_records doesn't have exchange column, we filter by symbol prefix
   */
  async getStatsByExchange(exchange: string): Promise<{
    totalGaps: number;
    totalMissingTrades: number;
    symbolsAffected: number;
    oldestGap: number | null;
    newestGap: number | null;
  }> {
    const db = this.ensureOpen();

    // Get all gaps (we'll filter by exchange in the query if needed)
    const sql = `
      SELECT 
        COUNT(*) as totalGaps,
        COALESCE(SUM(gap_size), 0) as totalMissingTrades,
        COUNT(DISTINCT symbol) as symbolsAffected,
        MIN(detected_at) as oldestGap,
        MAX(detected_at) as newestGap
      FROM gap_records
    `;

    const result = db.prepare(sql).get() as
      | {
          totalGaps: number;
          totalMissingTrades: number;
          symbolsAffected: number;
          oldestGap: number | null;
          newestGap: number | null;
        }
      | undefined;

    return {
      totalGaps: result?.totalGaps ?? 0,
      totalMissingTrades: result?.totalMissingTrades ?? 0,
      symbolsAffected: result?.symbolsAffected ?? 0,
      oldestGap: result?.oldestGap ?? null,
      newestGap: result?.newestGap ?? null,
    };
  }

  /**
   * Close the reader
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

/**
 * Factory function to create a GapReader
 */
export function createGapReader(
  config: ReadOnlyGapStorageConfig
): GapReaderPort {
  return new ReadOnlyGapStorage(config);
}
