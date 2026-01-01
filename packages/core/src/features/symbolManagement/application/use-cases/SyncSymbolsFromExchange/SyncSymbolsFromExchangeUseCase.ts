/**
 * Use Case: Sync Symbols From Exchange
 * Cronjob use case - runs every 1 hour for all enabled exchanges
 *
 * Responsibilities:
 * 1. Fetch current symbols from specified exchange API
 * 2. Compare with database
 * 3. Detect new symbols → mark as PENDING_REVIEW
 * 4. Detect delisted symbols → mark as DELISTED
 * 5. Update symbol metadata (tick value, precision, etc.)
 */

import { injectable, inject } from 'inversify';
import { SymbolRepository } from '../../../domain/repositories/SymbolRepository.js';
import { Symbol, SymbolStatus } from '../../../domain/entities/Symbol.js';
import {
  BinanceMetadata,
  BybitMetadata,
  OKXMetadata,
  Exchange,
} from '../../../domain/types/ExchangeMetadata.js';
import { ExchangeApiClientFactory } from '../../../../exchangeManagement/infrastructure/adapters/api/ExchangeApiClientFactory.js';
import { ExchangeSymbol } from '../../../../exchangeManagement/application/ports/out/ExchangeApiClient.js';
import { SYMBOL_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/symbolManagement/types.js';
import { EXCHANGE_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/exchangeManagement/types.js';
import { createLogger } from '../../../../../shared/lib/logger/logger.js';
import { SyncSymbolsInput, SyncResult } from './DTO.js';

const logger = createLogger('SyncSymbolsFromExchangeUseCase');

@injectable()
export class SyncSymbolsFromExchangeUseCase {
  constructor(
    @inject(SYMBOL_MANAGEMENT_TYPES.SymbolRepository)
    private symbolRepository: SymbolRepository,

    @inject(EXCHANGE_MANAGEMENT_TYPES.ExchangeApiClientFactory)
    private exchangeFactory: ExchangeApiClientFactory
  ) {}

  async execute(input: SyncSymbolsInput): Promise<SyncResult> {
    const { exchange } = input;
    const startTime = Date.now();
    logger.info(`🔄 Starting ${exchange} symbol sync...`);

    const result: SyncResult = {
      success: false,
      exchange,
      newSymbols: [],
      delistedSymbols: [],
      updatedSymbols: [],
      errors: [],
      timestamp: new Date(),
    };

    try {
      // Check if exchange is supported by the API client factory
      if (!this.isSupportedExchange(exchange)) {
        logger.warn(
          `Exchange ${exchange} is not supported by API client factory, skipping sync`
        );
        return {
          exchange,
          success: false,
          newSymbols: [],
          delistedSymbols: [],
          updatedSymbols: [],
          errors: [`Exchange ${exchange} is not supported`],
          timestamp: new Date(),
        };
      }

      // Step 1: Fetch current symbols from exchange using ExchangeApiClientFactory
      const exchangeClient = this.exchangeFactory.getClient(exchange as any);
      const exchangeSymbols = await exchangeClient.fetchSymbols();
      logger.info(
        `📥 Fetched ${exchangeSymbols.length} symbols from ${exchange}`
      );

      // Step 2: Fetch all symbols from database for this exchange
      const dbSymbols = await this.symbolRepository.findAll();
      const dbSymbolsForExchange = dbSymbols.filter(
        (s) => s.exchange === exchange
      );
      logger.info(
        `📊 Found ${dbSymbolsForExchange.length} ${exchange} symbols in database`
      );

      // Step 3: Create lookup maps
      const exchangeMap = new Map<string, ExchangeSymbol>(
        exchangeSymbols.map((s: ExchangeSymbol) => [s.symbol, s])
      );
      const dbMap = new Map<string, Symbol>(
        dbSymbolsForExchange.map((s: Symbol) => [s.symbol, s])
      );

      // Step 4: Detect new symbols
      for (const [symbolName, exchangeInfo] of exchangeMap.entries()) {
        if (!dbMap.has(symbolName)) {
          await this.handleNewSymbol(exchange, exchangeInfo, result);
        } else {
          await this.handleExistingSymbol(
            exchange,
            dbMap.get(symbolName)!,
            exchangeInfo,
            result
          );
        }
      }

      // Step 5: Detect delisted symbols
      for (const [symbolName, dbSymbol] of dbMap.entries()) {
        if (
          !exchangeMap.has(symbolName) &&
          dbSymbol.status !== SymbolStatus.DELISTED
        ) {
          await this.handleDelistedSymbol(dbSymbol, result);
        }
      }

      result.success = true;
      const duration = Date.now() - startTime;

      logger.info(`✅ ${exchange} sync completed in ${duration}ms`, {
        newSymbols: result.newSymbols.length,
        delistedSymbols: result.delistedSymbols.length,
        updatedSymbols: result.updatedSymbols.length,
        errors: result.errors.length,
      });
    } catch (error) {
      logger.error(`❌ ${exchange} sync failed:`, error);
      result.errors.push(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    return result;
  }

  /**
   * Handle new symbol discovered
   */
  private async handleNewSymbol(
    exchange: Exchange,
    exchangeSymbol: ExchangeSymbol,
    result: SyncResult
  ): Promise<void> {
    try {
      // Create exchange-specific metadata
      const metadata = this.createExchangeMetadata(exchange, exchangeSymbol);

      const newSymbol = new Symbol(
        this.generateId(),
        exchangeSymbol.symbol,
        exchange,
        {
          tickValue: parseFloat(exchangeSymbol.filters.tickSize || '0.1'),
          minQuantity: parseFloat(exchangeSymbol.filters.minQty || '0.001'),
          maxQuantity: parseFloat(exchangeSymbol.filters.maxQty || '9000'),
          pricePrecision: exchangeSymbol.pricePrecision,
          quantityPrecision: exchangeSymbol.quantityPrecision,
        },
        SymbolStatus.PENDING_REVIEW, // Requires admin approval
        false, // Not streaming yet
        false, // Not processing yet
        metadata, // Exchange-specific metadata
        false, // Not enabled by admin yet
        undefined, // No delisted date
        `New symbol detected by cronjob from ${exchange} - awaiting admin review`
      );

      await this.symbolRepository.save(newSymbol);
      result.newSymbols.push(exchangeSymbol.symbol);

      logger.info(
        `🆕 New symbol detected on ${exchange}: ${exchangeSymbol.symbol}`
      );
    } catch (error) {
      logger.error(
        `Failed to save new symbol ${exchangeSymbol.symbol} from ${exchange}:`,
        error
      );
      result.errors.push(`New symbol ${exchangeSymbol.symbol}: ${error}`);
    }
  }

  /**
   * Handle existing symbol update
   */
  private async handleExistingSymbol(
    exchange: Exchange,
    dbSymbol: Symbol,
    exchangeSymbol: ExchangeSymbol,
    result: SyncResult
  ): Promise<void> {
    try {
      // Create updated exchange metadata
      const metadata = this.createExchangeMetadata(exchange, exchangeSymbol);

      // Update metadata from exchange
      dbSymbol.updateFromExchangeSync(metadata, {
        tickValue: parseFloat(
          exchangeSymbol.filters.tickSize ||
            dbSymbol.config.tickValue.toString()
        ),
        minQuantity: parseFloat(
          exchangeSymbol.filters.minQty ||
            dbSymbol.config.minQuantity.toString()
        ),
        maxQuantity: parseFloat(
          exchangeSymbol.filters.maxQty ||
            dbSymbol.config.maxQuantity.toString()
        ),
        pricePrecision: exchangeSymbol.pricePrecision,
        quantityPrecision: exchangeSymbol.quantityPrecision,
      });

      await this.symbolRepository.save(dbSymbol);
      result.updatedSymbols.push(dbSymbol.symbol);
    } catch (error) {
      logger.error(
        `Failed to update symbol ${dbSymbol.symbol} on ${exchange}:`,
        error
      );
      result.errors.push(`Update ${dbSymbol.symbol}: ${error}`);
    }
  }

  /**
   * Handle delisted symbol
   */
  private async handleDelistedSymbol(
    dbSymbol: Symbol,
    result: SyncResult
  ): Promise<void> {
    try {
      dbSymbol.markAsDelisted();
      await this.symbolRepository.save(dbSymbol);
      result.delistedSymbols.push(dbSymbol.symbol);

      logger.warn(`⚠️ Symbol delisted: ${dbSymbol.symbol}`);
    } catch (error) {
      logger.error(
        `Failed to mark symbol as delisted ${dbSymbol.symbol}:`,
        error
      );
      result.errors.push(`Delist ${dbSymbol.symbol}: ${error}`);
    }
  }

  /**
   * Create exchange-specific metadata
   */
  private createExchangeMetadata(
    exchange: Exchange,
    exchangeSymbol: ExchangeSymbol
  ): BinanceMetadata | BybitMetadata | OKXMetadata {
    const baseMetadata = {
      baseAsset: exchangeSymbol.baseAsset,
      quoteAsset: exchangeSymbol.quoteAsset,
      lastSeenAt: new Date(),
    };

    switch (exchange.toLowerCase()) {
      case 'binance':
        return {
          ...baseMetadata,
          exchange: 'binance',
          status: exchangeSymbol.status as 'TRADING' | 'BREAK' | 'HALT',
          contractType: exchangeSymbol.contractType as any,
        } as BinanceMetadata;

      case 'bybit':
        return {
          ...baseMetadata,
          exchange: 'bybit',
          status: exchangeSymbol.status as 'Trading' | 'Closed',
          contractType: exchangeSymbol.contractType as
            | 'LinearPerpetual'
            | 'InversePerpetual',
        } as BybitMetadata;

      case 'okx':
        return {
          ...baseMetadata,
          exchange: 'okx',
          state: exchangeSymbol.status as 'live' | 'suspend' | 'preopen',
          instType: exchangeSymbol.contractType as 'SWAP' | 'FUTURES' | 'SPOT',
        } as OKXMetadata;

      default:
        // Fallback to generic metadata
        return {
          ...baseMetadata,
          exchange: 'binance',
          status: 'TRADING' as const,
          contractType: undefined,
        } as BinanceMetadata;
    }
  }

  /**
   * Generate unique ID for symbol
   */
  private generateId(): string {
    return `symbol_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;
  }

  /**
   * Check if exchange is supported by the API client factory
   */
  private isSupportedExchange(exchange: Exchange): boolean {
    return ['binance', 'bybit', 'okx'].includes(exchange);
  }
}
