/**
 * Symbol Management Service - Application Layer
 * Orchestrates symbol management use cases
 *
 * Follows hexagonal architecture: Service → Use Cases → Repository
 * Implements SymbolManagementPort (Inbound Port)
 */

import { injectable, inject, optional } from 'inversify';
import { createLogger } from '../../../../shared/lib/logger/logger.js';
import {
  SymbolManagementPort,
  type SyncResult,
} from '../ports/in/SymbolManagementPort.js';
import { SyncSymbolsFromExchangeUseCase } from '../use-cases/SyncSymbolsFromExchange/index.js';
import { ActivateSymbolUseCase } from '../use-cases/ActivateSymbol/index.js';
import { DeactivateSymbolUseCase } from '../use-cases/DeactivateSymbol/index.js';
import { ExchangeManagementPort } from '../../../exchangeManagement/application/ports/in/ExchangeManagementPort.js';
import { SYMBOL_MANAGEMENT_TYPES } from '../../../../shared/lib/di/bindings/features/symbolManagement/types.js';
import { EXCHANGE_MANAGEMENT_TYPES } from '../../../../shared/lib/di/bindings/features/exchangeManagement/types.js';
import { CORE_TYPES } from '../../../../shared/lib/di/core/types.js';
import { MARKET_DATA_TYPES } from '../../../../shared/lib/di/bindings/features/marketData/types.js';
import { CronSchedulerPort } from '../../../../shared/infrastructure/cron/index.js';
import type { Exchange } from '../../domain/types/ExchangeMetadata.js';
import type { Symbol } from '../../domain/entities/Symbol.js';
import { SymbolRepository } from '../../domain/repositories/SymbolRepository.js';
import type { TradeIngestionPort } from '../../../marketData/application/ports/in/TradeIngestionPort.js';

const logger = createLogger('SymbolManagementService');

/**
 * Symbol Management Service
 * Implements SymbolManagementPort and orchestrates use cases
 */
@injectable()
export class SymbolManagementService implements SymbolManagementPort {
  constructor(
    @inject(SYMBOL_MANAGEMENT_TYPES.SyncSymbolsFromExchangeUseCase)
    private syncSymbolsUseCase: SyncSymbolsFromExchangeUseCase,
    @inject(SYMBOL_MANAGEMENT_TYPES.ActivateSymbolUseCase)
    private activateSymbolUseCase: ActivateSymbolUseCase,
    @inject(SYMBOL_MANAGEMENT_TYPES.DeactivateSymbolUseCase)
    private deactivateSymbolUseCase: DeactivateSymbolUseCase,
    @inject(SYMBOL_MANAGEMENT_TYPES.SymbolRepository)
    private symbolRepository: SymbolRepository,
    @inject(EXCHANGE_MANAGEMENT_TYPES.ExchangeManagementPort)
    private exchangeManagementPort: ExchangeManagementPort,
    @inject(CORE_TYPES.CronSchedulerPort)
    private cronScheduler: CronSchedulerPort,
    @inject(MARKET_DATA_TYPES.TradeIngestionPort)
    @optional()
    private tradeIngestionPort?: TradeIngestionPort
  ) {}

  /**
   * Sync symbols from exchange
   * Orchestrates SyncSymbolsFromExchangeUseCase
   */
  async syncSymbolsFromExchange(exchange: Exchange): Promise<SyncResult> {
    try {
      logger.info(`Syncing symbols from ${exchange}...`);

      const result = await this.syncSymbolsUseCase.execute({
        exchange,
      });

      logger.info(
        `Sync complete for ${exchange}: +${result.newSymbols.length} added, ~${result.updatedSymbols.length} updated, -${result.delistedSymbols.length} delisted`
      );

      // Map use case result to port result
      return {
        success: result.success,
        exchange,
        symbolsAdded: result.newSymbols.length,
        symbolsUpdated: result.updatedSymbols.length,
        symbolsDelisted: result.delistedSymbols.length,
        totalSymbols:
          result.newSymbols.length +
          result.updatedSymbols.length +
          result.delistedSymbols.length,
        errors: result.errors,
        timestamp: result.timestamp,
      };
    } catch (error) {
      logger.error(`Failed to sync symbols from ${exchange}:`, error);
      throw error;
    }
  }

  /**
   * Activate a symbol
   * Orchestrates ActivateSymbolUseCase
   */
  async activateSymbol(symbolId: string): Promise<Symbol> {
    try {
      const result = await this.activateSymbolUseCase.execute({
        symbolId,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to activate symbol');
      }

      logger.info(`Activated symbol: ${result.symbol}`);

      // Fetch and return the symbol
      const symbols = await this.symbolRepository.findAll();
      const symbol = symbols.find((s) => s.id === symbolId);
      if (!symbol) {
        throw new Error(`Symbol ${symbolId} not found after activation`);
      }
      return symbol;
    } catch (error) {
      logger.error(`Failed to activate symbol ${symbolId}:`, error);
      throw error;
    }
  }

  /**
   * Deactivate a symbol
   * Orchestrates DeactivateSymbolUseCase
   */
  async deactivateSymbol(symbolId: string): Promise<Symbol> {
    try {
      const result = await this.deactivateSymbolUseCase.execute({
        symbolId,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to deactivate symbol');
      }

      logger.info(`Deactivated symbol: ${result.symbol}`);

      // Fetch and return the symbol
      const symbols = await this.symbolRepository.findAll();
      const symbol = symbols.find((s) => s.id === symbolId);
      if (!symbol) {
        throw new Error(`Symbol ${symbolId} not found after deactivation`);
      }
      return symbol;
    } catch (error) {
      logger.error(`Failed to deactivate symbol ${symbolId}:`, error);
      throw error;
    }
  }

  /**
   * Enable a symbol by admin
   * Sets enabledByAdmin flag to true
   */
  async enableSymbolByAdmin(symbolId: string): Promise<Symbol> {
    try {
      logger.info(`Enabling symbol by admin: ${symbolId}`);

      // Find the symbol
      const symbol = await this.findSymbolById(symbolId);
      if (!symbol) {
        throw new Error(`Symbol not found: ${symbolId}`);
      }

      // Update enabledByAdmin flag
      symbol.enabledByAdmin = true;
      symbol.updatedAt = new Date();

      // Save the symbol
      const savedSymbol = await this.symbolRepository.save(symbol);

      logger.info(`✅ Symbol enabled by admin: ${symbolId}`);
      return savedSymbol;
    } catch (error) {
      logger.error(`Failed to enable symbol by admin ${symbolId}:`, error);
      throw error;
    }
  }

  /**
   * Disable a symbol by admin
   * Sets enabledByAdmin flag to false
   */
  async disableSymbolByAdmin(symbolId: string): Promise<Symbol> {
    try {
      logger.info(`Disabling symbol by admin: ${symbolId}`);

      // Find the symbol
      const symbol = await this.findSymbolById(symbolId);
      if (!symbol) {
        throw new Error(`Symbol not found: ${symbolId}`);
      }

      // If symbol is currently active, remove from pipeline first
      if (symbol.status === 'active' && this.tradeIngestionPort) {
        try {
          const status = await this.tradeIngestionPort.getStatus();
          if (
            status.isRunning &&
            status.connectedSymbols.includes(symbol.symbol)
          ) {
            logger.info(
              `Removing symbol ${symbol.symbol} from trade ingestion pipeline (admin disable)...`
            );
            const removeResult = await this.tradeIngestionPort.removeSymbols([
              symbol.symbol,
            ]);
            if (removeResult.success && removeResult.removed.length > 0) {
              logger.info(
                `✅ Symbol ${symbol.symbol} removed from trade ingestion pipeline`
              );
            } else if (removeResult.failed.length > 0) {
              logger.warn(
                `⚠️ Failed to remove symbol ${symbol.symbol} from pipeline: ${removeResult.message}`
              );
            }
          }
        } catch (pipelineError) {
          // Don't fail disable if pipeline remove fails
          logger.warn(
            `Failed to remove symbol from pipeline (non-fatal): ${pipelineError}`
          );
        }
      }

      // Update enabledByAdmin flag
      symbol.enabledByAdmin = false;
      symbol.updatedAt = new Date();

      // If symbol is currently active, deactivate it
      if (symbol.status === 'active') {
        symbol.status = 'inactive' as any;
        symbol.isStreaming = false;
        symbol.isProcessing = false;
      }

      // Save the symbol
      const savedSymbol = await this.symbolRepository.save(symbol);

      logger.info(`✅ Symbol disabled by admin: ${symbolId}`);
      return savedSymbol;
    } catch (error) {
      logger.error(`Failed to disable symbol by admin ${symbolId}:`, error);
      throw error;
    }
  }

  /**
   * Find symbol by ID (helper method)
   */
  private async findSymbolById(symbolId: string): Promise<Symbol | null> {
    // Try to parse composite key format "exchange:symbol"
    if (symbolId.includes(':')) {
      const [exchange, symbol] = symbolId.split(':');
      return await this.symbolRepository.findBySymbol(symbol, exchange);
    }

    // Otherwise, search through all symbols
    const allSymbols = await this.symbolRepository.findAll();
    return allSymbols.find((s) => s.id === symbolId) || null;
  }

  /**
   * Get all symbols with optional filters
   * Delegates to repository
   */
  async getSymbols(filters?: {
    exchange?: Exchange;
    status?: string;
    enabledByAdmin?: boolean;
  }): Promise<Symbol[]> {
    try {
      return await this.symbolRepository.findAll(filters as any);
    } catch (error) {
      logger.error('Failed to get symbols:', error);
      throw error;
    }
  }

  /**
   * Get symbol by ID
   * Delegates to repository
   */
  async getSymbolById(symbolId: string): Promise<Symbol | null> {
    try {
      const symbols = await this.symbolRepository.findAll();
      return symbols.find((s) => s.id === symbolId) || null;
    } catch (error) {
      logger.error(`Failed to get symbol ${symbolId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // Scheduled Synchronization Operations
  // ============================================================================

  /**
   * Start scheduled symbol synchronization
   * Sets up recurring cron job to sync all enabled exchanges every hour
   */
  async startScheduledSync(): Promise<void> {
    logger.info('Starting scheduled symbol sync...');

    try {
      await this.cronScheduler.scheduleRecurring(
        '0 * * * *', // Every hour at minute 0
        'symbol-sync-all',
        async () => {
          await this.runSyncNow();
        }
      );

      logger.info('✅ Scheduled symbol sync started (runs every hour)');
    } catch (error) {
      logger.error('Failed to start scheduled symbol sync:', error);
      throw error;
    }
  }

  /**
   * Stop scheduled symbol synchronization
   * Cancels the recurring cron job
   */
  async stopScheduledSync(): Promise<void> {
    try {
      await this.cronScheduler.cancelSchedule('symbol-sync-all');
      logger.info('❌ Scheduled symbol sync stopped');
    } catch (error) {
      logger.error('Failed to stop scheduled symbol sync:', error);
      throw error;
    }
  }

  /**
   * Run symbol synchronization now for all enabled exchanges
   * Manual trigger for immediate synchronization
   */
  async runSyncNow(): Promise<void> {
    logger.info('🔄 Starting manual symbol sync for all enabled exchanges...');

    try {
      // Get enabled exchanges through ExchangeManagementPort
      const enabledExchanges = await this.exchangeManagementPort.getExchanges({
        enabled: true,
      });

      if (enabledExchanges.length === 0) {
        logger.warn('⚠️ No enabled exchanges found, skipping sync');
        return;
      }

      logger.info(
        `📋 Found ${
          enabledExchanges.length
        } enabled exchanges: ${enabledExchanges.map((e) => e.id).join(', ')}`
      );

      // Sync each exchange sequentially
      const allResults = [];
      for (const exchange of enabledExchanges) {
        try {
          logger.info(`🔄 Syncing ${exchange.id}...`);

          const result = await this.syncSymbolsFromExchange(
            exchange.id as Exchange
          );
          allResults.push(result);

          if (result.success) {
            logger.info(`✅ ${exchange.id} sync completed`, {
              symbolsAdded: result.symbolsAdded,
              symbolsUpdated: result.symbolsUpdated,
              symbolsDelisted: result.symbolsDelisted,
              errors: result.errors?.length || 0,
            });

            // Log new symbols if any
            if (result.symbolsAdded > 0) {
              logger.info(
                `🆕 ${exchange.id} added ${result.symbolsAdded} new symbols`
              );
            }

            // Log delisted symbols if any
            if (result.symbolsDelisted > 0) {
              logger.warn(
                `⚠️ ${exchange.id} delisted ${result.symbolsDelisted} symbols`
              );
            }

            // Log errors if any
            if (result.errors && result.errors.length > 0) {
              logger.error(
                `${exchange.id} sync completed with errors:`,
                result.errors
              );
            }
          } else {
            logger.error(`❌ ${exchange.id} sync failed`, {
              errors: result.errors,
            });
          }
        } catch (error) {
          logger.error(`❌ ${exchange.id} sync crashed:`, error);
          // Continue with next exchange even if one fails
        }
      }

      // Log overall summary
      const totalAdded = allResults.reduce((sum, r) => sum + r.symbolsAdded, 0);
      const totalUpdated = allResults.reduce(
        (sum, r) => sum + r.symbolsUpdated,
        0
      );
      const totalDelisted = allResults.reduce(
        (sum, r) => sum + r.symbolsDelisted,
        0
      );
      const totalErrors = allResults.reduce(
        (sum, r) => sum + (r.errors?.length || 0),
        0
      );
      const successCount = allResults.filter((r) => r.success).length;

      logger.info('📊 Overall sync summary:', {
        exchanges: `${successCount}/${enabledExchanges.length} successful`,
        totalAdded,
        totalUpdated,
        totalDelisted,
        totalErrors,
      });
    } catch (error) {
      logger.error('❌ Symbol sync crashed:', error);
      throw error;
    }
  }
}
