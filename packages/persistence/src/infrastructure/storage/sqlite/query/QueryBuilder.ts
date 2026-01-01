/**
 * Query Builder
 * Provides SQL query building logic for candle storage operations.
 * Supports filtering, aggregation, and cross-symbol queries.
 */

/**
 * Query filter options for candle queries
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
 * Aggregation options for GROUP BY queries
 */
export interface AggregationOptions {
  /** Columns to group by */
  groupBy: ('symbol' | 'exchange' | 'timeframe')[];
  /** Filter conditions */
  filter?: {
    symbols?: string[];
    startTime?: number;
    endTime?: number;
  };
  /** HAVING clause conditions */
  having?: {
    minCount?: number;
  };
}

/**
 * Built query result with SQL and parameters
 */
export interface BuiltQuery {
  sql: string;
  params: Record<string, unknown>;
}

/**
 * SQL Query Builder
 * Builds SQL queries for candle storage operations.
 * Provides type-safe query construction with parameterized queries.
 */
export class QueryBuilder {
  private tableName: string;

  constructor(tableName: string = 'candles') {
    this.tableName = tableName;
  }

  /**
   * Set the table name for queries
   */
  setTableName(tableName: string): this {
    this.tableName = tableName;
    return this;
  }

  /**
   * Build a SELECT query with filters
   */
  buildSelectQuery(columns: string[], filter: QueryFilter): BuiltQuery {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    // Build WHERE conditions
    if (filter.symbols) {
      if (Array.isArray(filter.symbols)) {
        const placeholders = filter.symbols
          .map((_, i) => `@symbol${i}`)
          .join(', ');
        filter.symbols.forEach((symbol, i) => {
          params[`symbol${i}`] = symbol;
        });
        conditions.push(`symbol IN (${placeholders})`);
      } else {
        params.symbol = filter.symbols;
        conditions.push('symbol = @symbol');
      }
    }

    if (filter.exchange) {
      params.exchange = filter.exchange;
      conditions.push('exchange = @exchange');
    }

    if (filter.timeframe) {
      params.timeframe = filter.timeframe;
      conditions.push('timeframe = @timeframe');
    }

    if (filter.startTime !== undefined) {
      params.startTime = filter.startTime;
      conditions.push('open_time >= @startTime');
    }

    if (filter.endTime !== undefined) {
      params.endTime = filter.endTime;
      conditions.push('open_time <= @endTime');
    }

    // Build SQL query
    let sql = `SELECT ${columns.join(', ')} FROM ${this.tableName}`;
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add ordering
    const orderDirection = filter.orderBy === 'asc' ? 'ASC' : 'DESC';
    sql += ` ORDER BY open_time ${orderDirection}`;

    // Add limit and offset
    if (filter.limit !== undefined) {
      params.limit = filter.limit;
      sql += ' LIMIT @limit';
    }

    if (filter.offset !== undefined) {
      params.offset = filter.offset;
      sql += ' OFFSET @offset';
    }

    return { sql, params };
  }

  /**
   * Build an aggregation query with GROUP BY
   */
  buildAggregationQuery(options: AggregationOptions): BuiltQuery {
    const selectColumns = [
      ...options.groupBy,
      'COUNT(*) as count',
      'MIN(open_time) as earliestTime',
      'MAX(open_time) as latestTime',
    ];

    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    // Build WHERE conditions
    if (options.filter?.symbols && options.filter.symbols.length > 0) {
      const placeholders = options.filter.symbols
        .map((_, i) => `@symbol${i}`)
        .join(', ');
      options.filter.symbols.forEach((symbol, i) => {
        params[`symbol${i}`] = symbol;
      });
      conditions.push(`symbol IN (${placeholders})`);
    }

    if (options.filter?.startTime !== undefined) {
      params.startTime = options.filter.startTime;
      conditions.push('open_time >= @startTime');
    }

    if (options.filter?.endTime !== undefined) {
      params.endTime = options.filter.endTime;
      conditions.push('open_time <= @endTime');
    }

    // Build SQL query
    let sql = `SELECT ${selectColumns.join(', ')} FROM ${this.tableName}`;
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` GROUP BY ${options.groupBy.join(', ')}`;

    // Add HAVING clause
    if (options.having?.minCount !== undefined) {
      params.minCount = options.having.minCount;
      sql += ' HAVING COUNT(*) > @minCount';
    }

    sql += ` ORDER BY ${options.groupBy[0]}`;

    return { sql, params };
  }

  /**
   * Build a cross-symbol query
   */
  buildCrossSymbolQuery(options: {
    exchange?: string;
    timeframe?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): BuiltQuery {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (options.exchange) {
      params.exchange = options.exchange;
      conditions.push('exchange = @exchange');
    }

    if (options.timeframe) {
      params.timeframe = options.timeframe;
      conditions.push('timeframe = @timeframe');
    }

    if (options.startTime !== undefined) {
      params.startTime = options.startTime;
      conditions.push('open_time >= @startTime');
    }

    if (options.endTime !== undefined) {
      params.endTime = options.endTime;
      conditions.push('open_time <= @endTime');
    }

    let sql: string;

    if (options.limit !== undefined) {
      // Apply limit per symbol using window function
      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      sql = `
        WITH ranked AS (
          SELECT symbol, data, ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY open_time DESC) as rn
          FROM ${this.tableName}
          ${whereClause}
        )
        SELECT symbol, data FROM ranked WHERE rn <= @limit
      `;
      params.limit = options.limit;
    } else {
      sql = `SELECT symbol, data FROM ${this.tableName}`;
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }
      sql += ' ORDER BY symbol, open_time DESC';
    }

    return { sql, params };
  }

  /**
   * Build a query to list unique symbols
   */
  buildListSymbolsQuery(options?: {
    exchange?: string;
    timeframe?: string;
  }): BuiltQuery {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (options?.exchange) {
      params.exchange = options.exchange;
      conditions.push('exchange = @exchange');
    }

    if (options?.timeframe) {
      params.timeframe = options.timeframe;
      conditions.push('timeframe = @timeframe');
    }

    let sql = `SELECT DISTINCT symbol FROM ${this.tableName}`;
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    sql += ' ORDER BY symbol';

    return { sql, params };
  }

  /**
   * Build a storage summary query
   */
  buildStorageSummaryQuery(): BuiltQuery {
    const sql = `
      SELECT 
        COUNT(*) as totalCandles,
        COUNT(DISTINCT symbol) as uniqueSymbols,
        COUNT(DISTINCT exchange) as uniqueExchanges,
        COUNT(DISTINCT timeframe) as uniqueTimeframes,
        MIN(open_time) as earliestCandle,
        MAX(open_time) as latestCandle
      FROM ${this.tableName}
    `;

    return { sql, params: {} };
  }

  /**
   * Build an INSERT OR REPLACE query for saving candles
   */
  buildUpsertQuery(): string {
    return `
      INSERT OR REPLACE INTO ${this.tableName} (
        id, symbol, exchange, timeframe, open_time, close_time, 
        data, created_at, updated_at
      ) VALUES (@id, @symbol, @exchange, @timeframe, @open_time, @close_time, @data, @created_at, @updated_at)
    `;
  }

  /**
   * Build a query to find candles by symbol
   */
  buildFindBySymbolQuery(options?: {
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): BuiltQuery {
    const conditions: string[] = [
      'symbol = @symbol',
      'exchange = @exchange',
      'timeframe = @timeframe',
    ];
    const params: Record<string, unknown> = {};

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
    )}`;
    sql += ' ORDER BY open_time DESC';

    if (options?.limit !== undefined) {
      params.limit = options.limit;
      sql += ' LIMIT @limit';
    }

    return { sql, params };
  }
}
