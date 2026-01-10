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
 * 6. Calculate and update binMultiplier for footprint aggregation
 *
 * Hexagonal Architecture:
 * - Uses Port Out (ExchangeApiPort, BinSizeCalculatorPort) instead of infrastructure
 * - Uses Port In (TradeIngestionPort) for cross-feature communication
 */

import { injectable, inject, optional } from 'inversify';
import { SymbolRepository } from '../../../domain/repositories/SymbolRepository.js';
import { Symbol, SymbolStatus } from '../../../domain/entities/Symbol.js';
import {
  BinanceMetadata,
  BybitMetadata,
  OKXMetadata,
  Exchange,
} from '../../../domain/types/ExchangeMetadata.js';
import type { Exchange as ExchangeApiExchange } from '../../../../exchangeManagement/domain/types/Exchange.js';
import { ExchangeSymbol } from '../../../../exchangeManagement/application/ports/out/ExchangeApiClient.js';
import type { ExchangeApiPort } from '../../../../exchangeManagement/application/ports/out/ExchangeApiPort.js';
import type { BinSizeCalculatorPort } from '../../../../candleProcessing/application/ports/out/BinSizeCalculatorPort.js';
import { TradeIngestionPort } from '../../../../marketData/application/ports/in/TradeIngestionPort.js';
import { ConfigSyncNotifierPort } from '../../ports/out/ConfigSyncNotifierPort.js';
import { SYMBOL_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/symbolManagement/types.js';
import { EXCHANGE_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/exchangeManagement/types.js';
import { MARKET_DATA_TYPES } from '../../../../../shared/lib/di/bindings/features/marketData/types.js';
import { CANDLE_PROCESSING_TYPES } from '../../../../../shared/lib/di/core/types.js';
import { createLogger } from '../../../../../shared/lib/logger/logger.js';
import { SyncSymbolsInput, SyncResult } from './DTO.js';

const logger = createLogger('SyncSymbolsFromExchangeUseCase');

// Removed PRICE_CHANGE_THRESHOLD - now always recalculate binMultiplier on sync
// This ensures algorithm changes are applied automatically without needing to delete DB

@injectable()
export class SyncSymbolsFromExchangeUseCase {
  /** Track symbols with config changes during sync for worker notification */
  private symbolsWithConfigChanges: string[] = [];
  /** Track symbols migrated (null binMultiplier → calculated) */
  private symbolsMigrated: string[] = [];

  constructor(
    @inject(SYMBOL_MANAGEMENT_TYPES.SymbolRepository)
    private symbolRepository: SymbolRepository,

    @inject(EXCHANGE_MANAGEMENT_TYPES.ExchangeApiPort)
    private exchangeApiPort: ExchangeApiPort,

    @inject(CANDLE_PROCESSING_TYPES.BinSizeCalculatorPort)
    private binSizeCalculatorPort: BinSizeCalculatorPort,

    @inject(MARKET_DATA_TYPES.TradeIngestionPort)
    @optional()
    private tradeIngestionPort?: TradeIngestionPort,

    @inject(SYMBOL_MANAGEMENT_TYPES.ConfigSyncNotifierPort)
    @optional()
    private configSyncNotifier?: ConfigSyncNotifierPort
  ) {}

  async execute(input: SyncSymbolsInput): Promise<SyncResult> {
    const { exchange } = input;
    const startTime = Date.now();
    logger.info(`🔄 Starting ${exchange} symbol sync...`);

    // Reset config changes tracker for this sync
    this.symbolsWithConfigChanges = [];
    this.symbolsMigrated = [];

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
      if (!this.exchangeApiPort.isSupported(exchange as ExchangeApiExchange)) {
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

      // Step 1: Fetch current symbols from exchange using ExchangeApiPort
      const exchangeClient = this.exchangeApiPort.getClient(
        exchange as ExchangeApiExchange
      );
      const exchangeSymbols = await exchangeClient.fetchSymbols();
      logger.info(
        `📥 Fetched ${exchangeSymbols.length} symbols from ${exchange}`
      );

      // Step 1.5: Fetch current prices for bin size calculation
      let priceMap: Map<string, number>;
      try {
        priceMap = await exchangeClient.fetchPrices();
        logger.info(`💰 Fetched ${priceMap.size} prices from ${exchange}`);
      } catch (priceError) {
        logger.warn(
          `⚠️ Failed to fetch prices from ${exchange}, binMultiplier will be null for new symbols:`,
          priceError
        );
        priceMap = new Map();
      }

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
        const currentPrice = priceMap.get(symbolName);
        if (!dbMap.has(symbolName)) {
          await this.handleNewSymbol(
            exchange,
            exchangeInfo,
            currentPrice,
            result
          );
        } else {
          await this.handleExistingSymbol(
            exchange,
            dbMap.get(symbolName)!,
            exchangeInfo,
            currentPrice,
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

      // Log migration results (symbols with null binMultiplier → calculated)
      if (this.symbolsMigrated.length > 0) {
        logger.info(
          `🔄 Migration: Updated ${this.symbolsMigrated.length} symbols with missing binMultiplier`,
          {
            migratedCount: this.symbolsMigrated.length,
            symbols: this.symbolsMigrated.slice(0, 10), // Log first 10
          }
        );
      }

      // Notify workers about config changes after successful sync
      if (this.symbolsWithConfigChanges.length > 0 && this.configSyncNotifier) {
        try {
          await this.configSyncNotifier.notifyConfigUpdate(
            this.symbolsWithConfigChanges
          );
          logger.info(
            `📢 Notified workers about ${this.symbolsWithConfigChanges.length} config changes`,
            {
              symbols: this.symbolsWithConfigChanges.slice(0, 10), // Log first 10
            }
          );
        } catch (notifyError) {
          // Non-blocking: log and continue
          logger.warn(
            `⚠️ Failed to notify workers of config changes (non-fatal):`,
            notifyError
          );
        }
      }
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
    currentPrice: number | undefined,
    result: SyncResult
  ): Promise<void> {
    try {
      // Create exchange-specific metadata
      const metadata = this.createExchangeMetadata(exchange, exchangeSymbol);

      const tickValue = parseFloat(exchangeSymbol.filters.tickSize || '0.1');

      // Calculate binMultiplier if price is available
      let binMultiplier: number | null = null;
      let tier: string | null = null;
      if (currentPrice && currentPrice > 0) {
        const binSizeResult =
          this.binSizeCalculatorPort.calculateOptimalBinSize(
            currentPrice,
            tickValue
          );
        binMultiplier = binSizeResult.binMultiplier;
        tier = binSizeResult.tier;

        logger.debug(
          `📊 Calculated binMultiplier for ${exchangeSymbol.symbol}: ${binMultiplier} (price: ${currentPrice}, tickValue: ${tickValue}, tier: ${tier})`
        );
      }

      const newSymbol = new Symbol(
        this.generateId(),
        exchangeSymbol.symbol,
        exchange,
        {
          tickValue,
          minQuantity: parseFloat(exchangeSymbol.filters.minQty || '0.001'),
          maxQuantity: parseFloat(exchangeSymbol.filters.maxQty || '9000'),
          pricePrecision: exchangeSymbol.pricePrecision,
          quantityPrecision: exchangeSymbol.quantityPrecision,
          binMultiplier,
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
        `🆕 New symbol detected on ${exchange}: ${
          exchangeSymbol.symbol
        } (binMultiplier: ${binMultiplier ?? 'auto'}, tier: ${
          tier ?? 'unknown'
        })`
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
   * Always recalculate binMultiplier from current price to ensure:
   * 1. Algorithm changes are applied automatically
   * 2. Price-based tier classification stays current
   */
  private async handleExistingSymbol(
    exchange: Exchange,
    dbSymbol: Symbol,
    exchangeSymbol: ExchangeSymbol,
    currentPrice: number | undefined,
    result: SyncResult
  ): Promise<void> {
    try {
      // Create updated exchange metadata
      const metadata = this.createExchangeMetadata(exchange, exchangeSymbol);

      const newTickValue = parseFloat(
        exchangeSymbol.filters.tickSize || dbSymbol.config.tickValue.toString()
      );

      // Always recalculate binMultiplier from current price
      const oldBinMultiplier = dbSymbol.config.binMultiplier;
      let newBinMultiplier = oldBinMultiplier;
      let configChanged = false;

      if (currentPrice && currentPrice > 0) {
        const binSizeResult =
          this.binSizeCalculatorPort.calculateOptimalBinSize(
            currentPrice,
            newTickValue
          );
        newBinMultiplier = binSizeResult.binMultiplier;

        // Track if binMultiplier actually changed
        if (oldBinMultiplier !== newBinMultiplier) {
          configChanged = true;
          logger.info(
            `📊 binMultiplier updated for ${dbSymbol.symbol}: ${oldBinMultiplier} → ${newBinMultiplier} (price: ${currentPrice}, tier: ${binSizeResult.tier})`
          );
        }
      }

      // Update metadata from exchange
      dbSymbol.updateFromExchangeSync(metadata, {
        tickValue: newTickValue,
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
        binMultiplier: newBinMultiplier,
      });

      await this.symbolRepository.save(dbSymbol);
      result.updatedSymbols.push(dbSymbol.symbol);

      // Track symbols with config changes for worker notification
      if (configChanged) {
        this.symbolsWithConfigChanges.push(dbSymbol.symbol);

        // Track migration specifically (null → calculated)
        if (oldBinMultiplier === null || oldBinMultiplier === undefined) {
          this.symbolsMigrated.push(dbSymbol.symbol);
        }
      }
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
   *
   * Steps:
   * 1. Remove from pipeline (WebSocket + workers) - non-blocking
   * 2. Update database status to DELISTED
   */
  private async handleDelistedSymbol(
    dbSymbol: Symbol,
    result: SyncResult
  ): Promise<void> {
    try {
      // Step 1: Remove from pipeline (WebSocket + workers) - non-blocking
      if (this.tradeIngestionPort) {
        try {
          const status = await this.tradeIngestionPort.getStatus();
          if (
            status.isRunning &&
            status.connectedSymbols.includes(dbSymbol.symbol)
          ) {
            await this.tradeIngestionPort.removeSymbols([dbSymbol.symbol]);
            logger.info(
              `🔌 Removed delisted symbol ${dbSymbol.symbol} from pipeline`
            );
          }
        } catch (pipelineError) {
          // Non-blocking: log and continue with DB update
          logger.warn(
            `⚠️ Failed to remove delisted symbol ${dbSymbol.symbol} from pipeline (non-fatal): ${pipelineError}`
          );
        }
      }

      // Step 2: Update database
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
}
