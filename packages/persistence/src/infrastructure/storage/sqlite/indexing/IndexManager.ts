/**
 * Index Manager
 * Manages database indexes for query optimization.
 * Provides dynamic index creation and performance monitoring.
 */

import type { ConnectionManager } from '../connection/ConnectionManager.js';

export interface IndexInfo {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  partial: boolean;
  sql: string;
}

export interface IndexStats {
  name: string;
  table: string;
  usage: number;
  lastUsed: number;
  size: number;
  efficiency: number;
}

export interface QueryPlan {
  query: string;
  usesIndex: boolean;
  indexName?: string;
  estimatedCost: number;
  scanType: 'SCAN' | 'SEARCH' | 'INDEX';
}

/**
 * Database Index Manager
 * Manages database indexes for optimal query performance.
 * Provides index creation, monitoring, and optimization capabilities.
 */
export class IndexManager {
  private connectionManager: ConnectionManager;
  private indexDefinitions: Map<string, IndexInfo> = new Map();

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.initializeIndexDefinitions();
  }

  /**
   * Initialize standard index definitions
   */
  private initializeIndexDefinitions(): void {
    // Primary indexes for candles table
    this.indexDefinitions.set('idx_symbol_timeframe', {
      name: 'idx_symbol_timeframe',
      table: 'candles',
      columns: ['symbol', 'timeframe', 'open_time'],
      unique: false,
      partial: false,
      sql: 'CREATE INDEX IF NOT EXISTS idx_symbol_timeframe ON candles(symbol, timeframe, open_time)',
    });

    this.indexDefinitions.set('idx_exchange_symbol', {
      name: 'idx_exchange_symbol',
      table: 'candles',
      columns: ['exchange', 'symbol'],
      unique: false,
      partial: false,
      sql: 'CREATE INDEX IF NOT EXISTS idx_exchange_symbol ON candles(exchange, symbol)',
    });

    this.indexDefinitions.set('idx_time_range', {
      name: 'idx_time_range',
      table: 'candles',
      columns: ['open_time', 'close_time'],
      unique: false,
      partial: false,
      sql: 'CREATE INDEX IF NOT EXISTS idx_time_range ON candles(open_time, close_time)',
    });

    this.indexDefinitions.set('idx_latest_candles', {
      name: 'idx_latest_candles',
      table: 'candles',
      columns: ['symbol', 'exchange', 'timeframe', 'open_time'],
      unique: false,
      partial: false,
      sql: 'CREATE INDEX IF NOT EXISTS idx_latest_candles ON candles(symbol, exchange, timeframe, open_time DESC)',
    });

    // Performance optimization indexes
    this.indexDefinitions.set('idx_cross_symbol', {
      name: 'idx_cross_symbol',
      table: 'candles',
      columns: ['exchange', 'timeframe', 'open_time'],
      unique: false,
      partial: false,
      sql: 'CREATE INDEX IF NOT EXISTS idx_cross_symbol ON candles(exchange, timeframe, open_time)',
    });
  }

  /**
   * Create all standard indexes
   */
  async createIndexes(): Promise<void> {
    const db = this.connectionManager.getConnection();

    try {
      console.log('Creating database indexes...');

      for (const [name, indexInfo] of this.indexDefinitions) {
        await this.createIndex(name);
      }

      console.log('Database indexes created successfully');
    } catch (error) {
      console.error('Failed to create indexes:', error);
      throw error;
    }
  }

  /**
   * Create a specific index
   */
  async createIndex(indexName: string): Promise<void> {
    const indexInfo = this.indexDefinitions.get(indexName);
    if (!indexInfo) {
      throw new Error(`Index definition not found: ${indexName}`);
    }

    const db = this.connectionManager.getConnection();

    try {
      console.log(`Creating index: ${indexName}`);
      db.exec(indexInfo.sql);
      console.log(`Index ${indexName} created successfully`);
    } catch (error) {
      console.error(`Failed to create index ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * Drop a specific index
   */
  async dropIndex(indexName: string): Promise<void> {
    const db = this.connectionManager.getConnection();

    try {
      console.log(`Dropping index: ${indexName}`);
      db.exec(`DROP INDEX IF EXISTS ${indexName}`);
      console.log(`Index ${indexName} dropped successfully`);
    } catch (error) {
      console.error(`Failed to drop index ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * Get all existing indexes
   */
  async getExistingIndexes(): Promise<IndexInfo[]> {
    const db = this.connectionManager.getConnection();

    try {
      const indexes = db
        .prepare(
          `
        SELECT 
          name,
          tbl_name as table_name,
          sql,
          "unique"
        FROM sqlite_master 
        WHERE type = 'index' 
        AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `
        )
        .all() as Array<{
        name: string;
        table_name: string;
        sql: string;
        unique: number;
      }>;

      const result: IndexInfo[] = [];

      for (const index of indexes) {
        // Parse columns from SQL (simplified)
        const columns = this.parseIndexColumns(index.sql);
        const partial = index.sql.includes('WHERE');

        result.push({
          name: index.name,
          table: index.table_name,
          columns,
          unique: index.unique === 1,
          partial,
          sql: index.sql,
        });
      }

      return result;
    } catch (error) {
      console.error('Failed to get existing indexes:', error);
      throw error;
    }
  }

  /**
   * Parse index columns from CREATE INDEX SQL
   */
  private parseIndexColumns(sql: string): string[] {
    // Simple regex to extract columns from CREATE INDEX statement
    const match = sql.match(/\(([^)]+)\)/);
    if (!match || !match[1]) return [];

    return match[1]
      .split(',')
      .map((col) => col.trim().replace(/\s+(ASC|DESC)$/i, ''))
      .filter((col) => col.length > 0);
  }

  /**
   * Analyze query performance
   */
  async analyzeQuery(query: string): Promise<QueryPlan> {
    const db = this.connectionManager.getConnection();

    try {
      // Get query plan
      const plan = db.prepare(`EXPLAIN QUERY PLAN ${query}`).all() as Array<{
        id: number;
        parent: number;
        notused: number;
        detail: string;
      }>;

      // Analyze plan details
      let usesIndex = false;
      let indexName: string | undefined;
      let scanType: 'SCAN' | 'SEARCH' | 'INDEX' = 'SCAN';
      let estimatedCost = 1000; // Default high cost

      for (const step of plan) {
        const detail = step.detail.toLowerCase();

        if (detail.includes('using index')) {
          usesIndex = true;
          scanType = 'INDEX';
          estimatedCost = 10; // Low cost for index usage

          // Extract index name
          const indexMatch = detail.match(/using index (\w+)/);
          if (indexMatch) {
            indexName = indexMatch[1];
          }
        } else if (detail.includes('search')) {
          scanType = 'SEARCH';
          estimatedCost = 100; // Medium cost for search
        } else if (detail.includes('scan')) {
          scanType = 'SCAN';
          estimatedCost = 1000; // High cost for full scan
        }
      }

      return {
        query,
        usesIndex,
        indexName,
        estimatedCost,
        scanType,
      };
    } catch (error) {
      console.error('Failed to analyze query:', error);
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<IndexStats[]> {
    const db = this.connectionManager.getConnection();

    try {
      const indexes = await this.getExistingIndexes();
      const stats: IndexStats[] = [];

      for (const index of indexes) {
        // Get index size (simplified - actual implementation would be more complex)
        const sizeResult = db
          .prepare(
            `
          SELECT COUNT(*) as count FROM ${index.table}
        `
          )
          .get() as { count: number };

        const estimatedSize = sizeResult.count * 50; // Rough estimate

        stats.push({
          name: index.name,
          table: index.table,
          usage: 0, // TODO: Implement usage tracking
          lastUsed: 0, // TODO: Implement last used tracking
          size: estimatedSize,
          efficiency: this.calculateIndexEfficiency(index),
        });
      }

      return stats;
    } catch (error) {
      console.error('Failed to get index stats:', error);
      throw error;
    }
  }

  /**
   * Calculate index efficiency score
   */
  private calculateIndexEfficiency(index: IndexInfo): number {
    // Simple efficiency calculation based on column count and type
    let score = 100;

    // Fewer columns generally more efficient
    if (index.columns.length > 3) {
      score -= 20;
    }

    // Partial indexes are more efficient for specific queries
    if (index.partial) {
      score += 10;
    }

    // Unique indexes are more efficient
    if (index.unique) {
      score += 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Suggest indexes for a query
   */
  async suggestIndexes(query: string): Promise<string[]> {
    try {
      const plan = await this.analyzeQuery(query);
      const suggestions: string[] = [];

      // If query doesn't use index and has high cost, suggest improvements
      if (!plan.usesIndex && plan.estimatedCost > 100) {
        // Parse query to identify potential index columns
        const queryLower = query.toLowerCase();

        if (queryLower.includes('where')) {
          if (
            queryLower.includes('symbol') &&
            queryLower.includes('timeframe')
          ) {
            suggestions.push(
              'Consider creating index on (symbol, timeframe, open_time)'
            );
          }

          if (queryLower.includes('exchange')) {
            suggestions.push('Consider creating index on (exchange, symbol)');
          }

          if (
            queryLower.includes('open_time') ||
            queryLower.includes('close_time')
          ) {
            suggestions.push(
              'Consider creating index on (open_time, close_time)'
            );
          }
        }

        if (queryLower.includes('order by')) {
          suggestions.push('Consider creating index on ORDER BY columns');
        }
      }

      return suggestions;
    } catch (error) {
      console.error('Failed to suggest indexes:', error);
      return [];
    }
  }

  /**
   * Optimize indexes based on usage patterns
   */
  async optimizeIndexes(): Promise<void> {
    try {
      console.log('Optimizing database indexes...');

      // Analyze existing indexes
      const stats = await this.getIndexStats();

      // Drop unused indexes (efficiency < 20 and no recent usage)
      for (const stat of stats) {
        if (stat.efficiency < 20 && stat.usage === 0) {
          console.log(`Dropping inefficient index: ${stat.name}`);
          await this.dropIndex(stat.name);
        }
      }

      // Rebuild indexes for better performance
      const db = this.connectionManager.getConnection();
      db.exec('REINDEX');

      console.log('Index optimization completed');
    } catch (error) {
      console.error('Failed to optimize indexes:', error);
      throw error;
    }
  }

  /**
   * Create exchange-specific indexes
   */
  async createExchangeIndexes(exchange: string): Promise<void> {
    const db = this.connectionManager.getConnection();
    const tableName = `${exchange}_candles`;

    try {
      console.log(`Creating indexes for exchange table: ${tableName}`);

      const indexes = [
        `CREATE INDEX IF NOT EXISTS idx_${exchange}_symbol_timeframe ON ${tableName}(symbol, timeframe, open_time)`,
        `CREATE INDEX IF NOT EXISTS idx_${exchange}_time_range ON ${tableName}(open_time, close_time)`,
        `CREATE INDEX IF NOT EXISTS idx_${exchange}_latest ON ${tableName}(symbol, timeframe, open_time DESC)`,
      ];

      for (const indexSql of indexes) {
        db.exec(indexSql);
      }

      console.log(`Exchange indexes created for ${tableName}`);
    } catch (error) {
      console.error(
        `Failed to create exchange indexes for ${tableName}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get index definitions
   */
  getIndexDefinitions(): Map<string, IndexInfo> {
    return new Map(this.indexDefinitions);
  }
}
