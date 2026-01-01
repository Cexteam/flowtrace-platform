/**
 * Use Case: Activate Symbol
 *
 * Activates a symbol for trading by:
 * 1. Verifying symbol exists
 * 2. Checking enabled_by_admin is true
 * 3. Updating status to "active"
 * 4. Setting is_streaming flag to true
 * 5. Adding symbol to trade ingestion pipeline (if running)
 *
 * Requirements: 7.1, 7.2
 */

import { injectable, inject, optional } from 'inversify';
import { SymbolRepository } from '../../../domain/repositories/SymbolRepository.js';
import { SymbolStatus } from '../../../domain/entities/Symbol.js';
import { SYMBOL_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/symbolManagement/types.js';
import { MARKET_DATA_TYPES } from '../../../../../shared/lib/di/bindings/features/marketData/types.js';
import { createLogger } from '../../../../../shared/lib/logger/logger.js';
import { ActivateSymbolRequest, ActivateSymbolResponse } from './DTO.js';
import type { TradeIngestionPort } from '../../../../marketData/application/ports/in/TradeIngestionPort.js';

const logger = createLogger('ActivateSymbolUseCase');

@injectable()
export class ActivateSymbolUseCase {
  constructor(
    @inject(SYMBOL_MANAGEMENT_TYPES.SymbolRepository)
    private symbolRepository: SymbolRepository,
    @inject(MARKET_DATA_TYPES.TradeIngestionPort)
    @optional()
    private tradeIngestionPort?: TradeIngestionPort
  ) {}

  async execute(
    request: ActivateSymbolRequest
  ): Promise<ActivateSymbolResponse> {
    const { symbolId } = request;

    try {
      logger.info(`Activating symbol: ${symbolId}`);

      // Step 1: Find symbol by ID
      const symbol = await this.findSymbolById(symbolId);

      if (!symbol) {
        return {
          success: false,
          symbolId,
          message: `Symbol not found: ${symbolId}`,
          error: 'SYMBOL_NOT_FOUND',
          timestamp: new Date(),
        };
      }

      // Step 2: Check if symbol can be activated
      if (!symbol.canActivate()) {
        const reason = this.getActivationFailureReason(symbol);
        logger.warn(`Cannot activate symbol ${symbolId}: ${reason}`);

        return {
          success: false,
          symbolId,
          symbol: symbol.symbol,
          exchange: symbol.exchange,
          message: `Cannot activate symbol: ${reason}`,
          error: 'ACTIVATION_PRECONDITIONS_NOT_MET',
          timestamp: new Date(),
        };
      }

      // Step 3: Activate symbol (domain logic)
      symbol.activate();

      // Step 4: Set streaming flag
      symbol.updateStreamingStatus(true);

      // Step 5: Persist changes
      await this.symbolRepository.save(symbol);

      // Step 6: Add symbol to trade ingestion pipeline (if running)
      if (this.tradeIngestionPort) {
        try {
          const status = await this.tradeIngestionPort.getStatus();
          if (status.isRunning) {
            logger.info(
              `Adding symbol ${symbol.symbol} to trade ingestion pipeline...`
            );
            const addResult = await this.tradeIngestionPort.addSymbols([
              symbol.symbol,
            ]);
            if (addResult.success && addResult.added.length > 0) {
              logger.info(
                `✅ Symbol ${symbol.symbol} added to trade ingestion pipeline`
              );
            } else if (addResult.failed.length > 0) {
              logger.warn(
                `⚠️ Failed to add symbol ${symbol.symbol} to pipeline: ${addResult.message}`
              );
            }
          } else {
            logger.info(
              `Trade ingestion not running, symbol ${symbol.symbol} will be picked up on next start`
            );
          }
        } catch (pipelineError) {
          // Don't fail activation if pipeline add fails
          logger.warn(
            `Failed to add symbol to pipeline (non-fatal): ${pipelineError}`
          );
        }
      }

      logger.info(`✅ Symbol activated successfully: ${symbolId}`);

      return {
        success: true,
        symbolId,
        symbol: symbol.symbol,
        exchange: symbol.exchange,
        message: `Symbol ${symbol.symbol} (${symbol.exchange}) activated successfully`,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error(`Failed to activate symbol ${symbolId}:`, error);

      return {
        success: false,
        symbolId,
        message: 'Failed to activate symbol',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Find symbol by ID
   * Note: Current repository doesn't have findById, so we need to parse the ID
   * ID format: "exchange:symbol" or generated ID
   */
  private async findSymbolById(symbolId: string): Promise<any | null> {
    // Try to parse composite key format "exchange:symbol"
    if (symbolId.includes(':')) {
      const [exchange, symbol] = symbolId.split(':');
      return await this.symbolRepository.findBySymbol(symbol, exchange);
    }

    // Otherwise, search through all symbols (less efficient)
    const allSymbols = await this.symbolRepository.findAll();
    return allSymbols.find((s) => s.id === symbolId) || null;
  }

  /**
   * Get human-readable reason why activation failed
   */
  private getActivationFailureReason(symbol: any): string {
    if (symbol.status === SymbolStatus.DELISTED) {
      return 'Symbol is delisted';
    }

    if (!symbol.enabledByAdmin) {
      return 'Symbol not approved by admin (enabled_by_admin = false)';
    }

    if (!symbol.exchangeMetadata) {
      return 'Missing exchange metadata';
    }

    // Check if symbol is active on exchange
    const isActiveOnExchange =
      symbol.exchangeMetadata.status === 'TRADING' ||
      symbol.exchangeMetadata.status === 'Trading' ||
      symbol.exchangeMetadata.status === 'live';

    if (!isActiveOnExchange) {
      return `Symbol not active on exchange (status: ${symbol.exchangeMetadata.status})`;
    }

    return 'Unknown reason';
  }
}
