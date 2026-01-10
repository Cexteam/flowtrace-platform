/**
 * Drizzle Symbol Repository Implementation
 *
 * Implements SymbolRepository interface using Drizzle ORM with SQLite.
 *
 */

import { injectable, inject } from 'inversify';
import { eq, and, inArray, lt, isNull } from 'drizzle-orm';
import { SymbolRepository } from '../../domain/repositories/SymbolRepository.js';
import { Symbol, SymbolStatus } from '../../domain/entities/Symbol.js';
import { DATABASE_SYMBOLS } from '../../../../shared/lib/di/bindings/core/database/types.js';
import type { DrizzleDatabase } from '../../../../shared/infrastructure/database/drizzle/types.js';
import { createLogger } from '../../../../shared/lib/logger/logger.js';
import type {
  Exchange,
  ExchangeMetadata,
} from '../../domain/types/ExchangeMetadata.js';

import {
  symbols,
  type SqliteSymbolRow,
} from '../../../../shared/infrastructure/database/schema/sqlite/index.js';

const logger = createLogger('DrizzleSymbolRepository');

@injectable()
export class DrizzleSymbolRepository implements SymbolRepository {
  private db: any;

  constructor(
    @inject(DATABASE_SYMBOLS.DrizzleDatabase)
    drizzleDatabase: DrizzleDatabase
  ) {
    this.db = drizzleDatabase.getDb();
    logger.debug('Initialized DrizzleSymbolRepository');
  }

  /**
   * Find symbol by symbol name and exchange
   */
  async findBySymbol(symbol: string, exchange: string): Promise<Symbol | null> {
    try {
      const result = await this.db
        .select()
        .from(symbols)
        .where(and(eq(symbols.symbol, symbol), eq(symbols.exchange, exchange)))
        .limit(1);

      return result[0] ? this.toDomain(result[0]) : null;
    } catch (error) {
      logger.error(`Failed to find symbol ${exchange}:${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Find all symbols with optional filters
   */
  async findAll(filters?: {
    exchange?: string;
    status?: SymbolStatus[] | SymbolStatus | string;
    isStreaming?: boolean;
    isProcessing?: boolean;
    enabledByAdmin?: boolean;
  }): Promise<Symbol[]> {
    try {
      logger.debug('findAll called with filters:', filters);
      let query = this.db.select().from(symbols);

      const conditions = [];

      if (filters?.exchange) {
        logger.debug(`Adding exchange filter: ${filters.exchange}`);
        conditions.push(eq(symbols.exchange, filters.exchange));
      }

      // Handle status filter - can be string, single status, or array
      if (filters?.status) {
        if (Array.isArray(filters.status) && filters.status.length > 0) {
          conditions.push(inArray(symbols.status, filters.status));
        } else if (typeof filters.status === 'string') {
          conditions.push(eq(symbols.status, filters.status));
        }
      }

      if (filters?.isStreaming !== undefined) {
        conditions.push(eq(symbols.isStreaming, filters.isStreaming));
      }

      if (filters?.isProcessing !== undefined) {
        conditions.push(eq(symbols.isProcessing, filters.isProcessing));
      }

      if (filters?.enabledByAdmin !== undefined) {
        conditions.push(eq(symbols.enabledByAdmin, filters.enabledByAdmin));
      }

      if (conditions.length > 0) {
        // Use and() only when there are multiple conditions
        // For single condition, use it directly
        const whereClause =
          conditions.length === 1 ? conditions[0] : and(...conditions);
        query = query.where(whereClause) as any;
      }

      const results = await query;
      logger.debug(
        `findAll returned ${results.length} symbols for filters:`,
        filters
      );
      return results.map((row: SqliteSymbolRow) => this.toDomain(row));
    } catch (error) {
      logger.error('Failed to find all symbols:', error);
      throw error;
    }
  }

  /**
   * Find symbols that need review
   */
  async findNeedingReview(): Promise<Symbol[]> {
    try {
      const results = await this.db
        .select()
        .from(symbols)
        .where(eq(symbols.status, 'pending_review'));

      return results.map((row: SqliteSymbolRow) => this.toDomain(row));
    } catch (error) {
      logger.error('Failed to find symbols needing review:', error);
      throw error;
    }
  }

  /**
   * Find active symbols (for startup)
   */
  async findActiveSymbols(): Promise<Symbol[]> {
    try {
      const results = await this.db
        .select()
        .from(symbols)
        .where(
          and(eq(symbols.status, 'active'), eq(symbols.enabledByAdmin, true))
        );

      return results.map((row: SqliteSymbolRow) => this.toDomain(row));
    } catch (error) {
      logger.error('Failed to find active symbols:', error);
      throw error;
    }
  }

  /**
   * Find symbols not seen recently (potential delisted)
   */
  async findStaleSymbols(olderThan: Date): Promise<Symbol[]> {
    try {
      const dateValue = olderThan.toISOString();

      const results = await this.db
        .select()
        .from(symbols)
        .where(
          and(lt(symbols.lastSyncAt, dateValue), isNull(symbols.delistedAt))
        );

      return results.map((row: SqliteSymbolRow) => this.toDomain(row));
    } catch (error) {
      logger.error('Failed to find stale symbols:', error);
      throw error;
    }
  }

  /**
   * Save or update symbol
   */
  async save(symbol: Symbol): Promise<Symbol> {
    try {
      const row = this.toDatabase(symbol);

      const result = await this.db
        .insert(symbols)
        .values(row)
        .onConflictDoUpdate({
          target: [symbols.id],
          set: {
            symbol: row.symbol,
            exchange: row.exchange,
            tickValue: row.tickValue,
            minQuantity: row.minQuantity,
            maxQuantity: row.maxQuantity,
            pricePrecision: row.pricePrecision,
            quantityPrecision: row.quantityPrecision,
            binMultiplier: row.binMultiplier,
            status: row.status,
            isStreaming: row.isStreaming,
            isProcessing: row.isProcessing,
            exchangeMetadata: row.exchangeMetadata,
            enabledByAdmin: row.enabledByAdmin,
            delistedAt: row.delistedAt,
            notes: row.notes,
            updatedAt: row.updatedAt,
            lastSyncAt: row.lastSyncAt,
          },
        })
        .returning();

      logger.debug(`Saved symbol: ${symbol.exchange}:${symbol.symbol}`);
      return this.toDomain(result[0]);
    } catch (error) {
      logger.error(
        `Failed to save symbol ${symbol.exchange}:${symbol.symbol}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Save multiple symbols (bulk operation)
   */
  async saveMany(symbolEntities: Symbol[]): Promise<Symbol[]> {
    try {
      if (symbolEntities.length === 0) {
        return [];
      }

      const rows = symbolEntities.map((s) => this.toDatabase(s));

      const results = await this.db
        .insert(symbols)
        .values(rows)
        .onConflictDoUpdate({
          target: [symbols.id],
          set: {
            lastSyncAt: new Date().toISOString(),
          },
        })
        .returning();

      logger.info(`Bulk saved ${results.length} symbols`);
      return results.map((row: SqliteSymbolRow) => this.toDomain(row));
    } catch (error) {
      logger.error('Failed to bulk save symbols:', error);
      throw error;
    }
  }

  /**
   * Delete symbol
   */
  async delete(symbolId: string): Promise<void> {
    try {
      await this.db.delete(symbols).where(eq(symbols.id, symbolId));
      logger.debug(`Deleted symbol: ${symbolId}`);
    } catch (error) {
      logger.error(`Failed to delete symbol ${symbolId}:`, error);
      throw error;
    }
  }

  /**
   * Check if symbol exists
   */
  async exists(symbol: string, exchange: string): Promise<boolean> {
    try {
      const result = await this.db
        .select({ id: symbols.id })
        .from(symbols)
        .where(and(eq(symbols.symbol, symbol), eq(symbols.exchange, exchange)))
        .limit(1);

      return result.length > 0;
    } catch (error) {
      logger.error(
        `Failed to check if symbol exists ${exchange}:${symbol}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Convert database row to domain entity
   */
  private toDomain(row: SqliteSymbolRow): Symbol {
    return new Symbol(
      row.id,
      row.symbol,
      row.exchange as Exchange,
      {
        tickValue: parseFloat(row.tickValue),
        minQuantity: parseFloat(row.minQuantity),
        maxQuantity: parseFloat(row.maxQuantity),
        pricePrecision: row.pricePrecision,
        quantityPrecision: row.quantityPrecision,
        binMultiplier: row.binMultiplier ?? null,
      },
      row.status as SymbolStatus,
      row.isStreaming,
      row.isProcessing,
      row.exchangeMetadata
        ? (JSON.parse(row.exchangeMetadata) as ExchangeMetadata)
        : null,
      row.enabledByAdmin,
      row.delistedAt ? new Date(row.delistedAt) : undefined,
      row.notes || undefined,
      new Date(row.createdAt),
      new Date(row.updatedAt),
      new Date(row.lastSyncAt)
    );
  }

  /**
   * Convert domain entity to database row format
   */
  private toDatabase(symbol: Symbol): any {
    return {
      id: symbol.id,
      symbol: symbol.symbol,
      exchange: symbol.exchange,
      tickValue: symbol.config.tickValue.toString(),
      minQuantity: symbol.config.minQuantity.toString(),
      maxQuantity: symbol.config.maxQuantity.toString(),
      pricePrecision: symbol.config.pricePrecision,
      quantityPrecision: symbol.config.quantityPrecision,
      binMultiplier: symbol.config.binMultiplier ?? null,
      status: symbol.status,
      isStreaming: symbol.isStreaming,
      isProcessing: symbol.isProcessing,
      exchangeMetadata: symbol.exchangeMetadata
        ? JSON.stringify(symbol.exchangeMetadata)
        : null,
      enabledByAdmin: symbol.enabledByAdmin,
      delistedAt: symbol.delistedAt?.toISOString() || null,
      notes: symbol.notes || null,
      createdAt: symbol.createdAt.toISOString(),
      updatedAt: symbol.updatedAt.toISOString(),
      lastSyncAt: symbol.lastSyncAt.toISOString(),
    };
  }
}
