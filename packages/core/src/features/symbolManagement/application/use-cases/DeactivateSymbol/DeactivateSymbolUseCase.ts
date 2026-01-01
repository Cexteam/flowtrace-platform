/**
 * Use Case: Deactivate Symbol
 *
 * Deactivates a symbol by:
 * 1. Finding the symbol
 * 2. Updating status to "inactive"
 * 3. Setting is_streaming flag to false
 * 4. Removing symbol from trade ingestion pipeline (if running)
 *
 * Requirements: 7.3
 */

import { injectable, inject, optional } from 'inversify';
import { SymbolRepository } from '../../../domain/repositories/SymbolRepository.js';
import { SymbolStatus } from '../../../domain/entities/Symbol.js';
import { SYMBOL_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/symbolManagement/types.js';
import { MARKET_DATA_TYPES } from '../../../../../shared/lib/di/bindings/features/marketData/types.js';
import { createLogger } from '../../../../../shared/lib/logger/logger.js';
import { DeactivateSymbolRequest, DeactivateSymbolResponse } from './DTO.js';
import type { TradeIngestionPort } from '../../../../marketData/application/ports/in/TradeIngestionPort.js';

const logger = createLogger('DeactivateSymbolUseCase');

@injectable()
export class DeactivateSymbolUseCase {
  constructor(
    @inject(SYMBOL_MANAGEMENT_TYPES.SymbolRepository)
    private symbolRepository: SymbolRepository,
    @inject(MARKET_DATA_TYPES.TradeIngestionPort)
    @optional()
    private tradeIngestionPort?: TradeIngestionPort
  ) {}

  async execute(
    request: DeactivateSymbolRequest
  ): Promise<DeactivateSymbolResponse> {
    const { symbolId } = request;

    try {
      logger.info(`Deactivating symbol: ${symbolId}`);

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

      // Step 2: Update status to inactive
      symbol.status = SymbolStatus.INACTIVE;
      symbol.updatedAt = new Date();

      // Step 3: Set streaming flag to false
      symbol.updateStreamingStatus(false);

      // Step 4: Persist changes
      await this.symbolRepository.save(symbol);

      // Step 5: Remove symbol from trade ingestion pipeline (if running)
      if (this.tradeIngestionPort) {
        try {
          const status = await this.tradeIngestionPort.getStatus();
          if (
            status.isRunning &&
            status.connectedSymbols.includes(symbol.symbol)
          ) {
            logger.info(
              `Removing symbol ${symbol.symbol} from trade ingestion pipeline...`
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
          // Don't fail deactivation if pipeline remove fails
          logger.warn(
            `Failed to remove symbol from pipeline (non-fatal): ${pipelineError}`
          );
        }
      }

      logger.info(`✅ Symbol deactivated successfully: ${symbolId}`);

      return {
        success: true,
        symbolId,
        symbol: symbol.symbol,
        exchange: symbol.exchange,
        message: `Symbol ${symbol.symbol} (${symbol.exchange}) deactivated successfully`,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error(`Failed to deactivate symbol ${symbolId}:`, error);

      return {
        success: false,
        symbolId,
        message: 'Failed to deactivate symbol',
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
}
