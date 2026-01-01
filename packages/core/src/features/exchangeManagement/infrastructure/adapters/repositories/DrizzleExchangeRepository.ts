/**
 * Drizzle Exchange Repository Implementation
 *
 * Implements ExchangeRepository interface using Drizzle ORM with SQLite.
 */

import { injectable, inject } from 'inversify';
import { eq, and } from 'drizzle-orm';
import {
  ExchangeRepository,
  ExchangeFilter,
} from '../../../domain/repositories/ExchangeRepository.js';
import { Exchange } from '../../../domain/entities/Exchange.js';
import { DATABASE_SYMBOLS } from '../../../../../shared/lib/di/bindings/core/database/types.js';
import type { DrizzleDatabase } from '../../../../../shared/infrastructure/database/drizzle/types.js';
import { exchanges } from '../../../../../shared/infrastructure/database/schema/sqlite/index.js';
import { createLogger } from '../../../../../shared/lib/logger/logger.js';

const logger = createLogger('DrizzleExchangeRepository');

@injectable()
export class DrizzleExchangeRepository implements ExchangeRepository {
  constructor(
    @inject(DATABASE_SYMBOLS.DrizzleDatabase)
    private db: DrizzleDatabase
  ) {}

  /**
   * Helper method để get database instance
   */
  private getDbInstance() {
    return this.db.getDb();
  }

  async findAll(filter?: ExchangeFilter): Promise<Exchange[]> {
    try {
      const dbInstance = this.getDbInstance();

      let query = (dbInstance as any).select().from(exchanges);

      // Apply filters if provided
      if (filter) {
        const conditions = [];

        if (filter.enabled !== undefined) {
          conditions.push(eq(exchanges.enabled, filter.enabled));
        }

        if (filter.implementationStatus) {
          conditions.push(
            eq(exchanges.implementationStatus, filter.implementationStatus)
          );
        }

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
      }

      const results = await query;
      return results.map((row: any) => this.toDomain(row));
    } catch (error) {
      logger.error('Failed to find all exchanges:', error);
      return this.getFallbackExchanges();
    }
  }

  async findById(id: string): Promise<Exchange | null> {
    try {
      const dbInstance = this.getDbInstance();

      const results = await (dbInstance as any)
        .select()
        .from(exchanges)
        .where(eq(exchanges.id, id))
        .limit(1);

      return results[0] ? this.toDomain(results[0]) : null;
    } catch (error) {
      logger.error(`Failed to find exchange by id ${id}:`, error);
      return null;
    }
  }

  async findEnabled(): Promise<Exchange[]> {
    return this.findAll({ enabled: true });
  }

  async save(exchange: Exchange): Promise<Exchange> {
    try {
      const dbInstance = this.getDbInstance();

      const data = this.toDatabase(exchange);

      // Try to update first, then insert if not exists
      const existing = await this.findById(exchange.id);

      if (existing) {
        await (dbInstance as any)
          .update(exchanges)
          .set({
            ...data,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(exchanges.id, exchange.id));
      } else {
        await (dbInstance as any).insert(exchanges).values(data);
      }

      // Return the saved exchange
      const saved = await this.findById(exchange.id);
      return saved || exchange;
    } catch (error) {
      logger.error(`Failed to save exchange ${exchange.id}:`, error);
      throw error;
    }
  }

  async updateEnabled(id: string, enabled: boolean): Promise<void> {
    try {
      const dbInstance = this.getDbInstance();

      await (dbInstance as any)
        .update(exchanges)
        .set({
          enabled,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(exchanges.id, id));
    } catch (error) {
      logger.error(
        `Failed to update enabled status for exchange ${id}:`,
        error
      );
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const dbInstance = this.getDbInstance();

      await (dbInstance as any).delete(exchanges).where(eq(exchanges.id, id));
    } catch (error) {
      logger.error(`Failed to delete exchange ${id}:`, error);
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const exchange = await this.findById(id);
      return exchange !== null;
    } catch (error) {
      logger.error(`Failed to check if exchange ${id} exists:`, error);
      return false;
    }
  }

  /**
   * Convert database row to domain entity
   */
  private toDomain(row: any): Exchange {
    return new Exchange(
      row.id,
      row.displayName,
      row.wsUrl,
      row.restUrl,
      row.rateLimitPerMinute,
      row.maxReconnectDelay ?? 60000,
      row.maxConnectAttempts ?? 300,
      row.syncRestLimit ?? 1000,
      row.syncCheckIntervalMinutes ?? 5,
      row.syncMissingThresholdMinutes ?? 1,
      row.implementationStatus,
      row.enabled,
      row.apiKey,
      row.apiSecret,
      new Date(row.createdAt),
      new Date(row.updatedAt)
    );
  }

  /**
   * Convert domain entity to database row format
   */
  private toDatabase(exchange: Exchange): any {
    return {
      id: exchange.id,
      displayName: exchange.displayName,
      implementationStatus: exchange.implementationStatus,
      enabled: exchange.enabled,
      wsUrl: exchange.wsUrl,
      restUrl: exchange.restUrl,
      apiKey: exchange.apiKey,
      apiSecret: exchange.apiSecret,
      rateLimitPerMinute: exchange.rateLimitPerMinute,
      maxReconnectDelay: exchange.maxReconnectDelay,
      maxConnectAttempts: exchange.maxConnectAttempts,
      syncRestLimit: exchange.syncRestLimit,
      syncCheckIntervalMinutes: exchange.syncCheckIntervalMinutes,
      syncMissingThresholdMinutes: exchange.syncMissingThresholdMinutes,
      createdAt: exchange.createdAt.toISOString(),
      updatedAt: exchange.updatedAt.toISOString(),
    };
  }

  /**
   * Fallback exchanges when database is unavailable
   */
  private getFallbackExchanges(): Exchange[] {
    return [
      new Exchange(
        'binance',
        'Binance',
        'wss://fstream.binance.com/stream',
        'https://fapi.binance.com',
        1200,
        60000,
        300,
        1000,
        5,
        1,
        'implemented',
        true,
        undefined,
        undefined,
        new Date(),
        new Date()
      ),
      new Exchange(
        'bybit',
        'Bybit',
        'wss://stream.bybit.com/v5/public/linear',
        'https://api.bybit.com',
        600,
        60000,
        300,
        1000,
        5,
        1,
        'implemented',
        true,
        undefined,
        undefined,
        new Date(),
        new Date()
      ),
      new Exchange(
        'okx',
        'OKX',
        'wss://ws.okx.com:8443/ws/v5/public',
        'https://www.okx.com',
        600,
        60000,
        300,
        100,
        5,
        1,
        'implemented',
        true,
        undefined,
        undefined,
        new Date(),
        new Date()
      ),
    ];
  }
}
