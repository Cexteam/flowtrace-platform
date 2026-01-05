import { inject, injectable } from 'inversify';
import { MARKET_DATA_TYPES } from '../../../../../shared/lib/di/bindings/features/marketData/types.js';
import { WORKER_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/workerManagement/types.js';
import { TradeStreamPort } from '../../../application/ports/out/TradeStreamPort.js';
import { WorkerManagementPort } from '../../../../workerManagement/application/ports/in/WorkerManagementPort.js';
import { createLogger } from '../../../../../shared/lib/logger/logger.js';
import type {
  RemoveSymbolsFromIngestionRequest,
  RemoveSymbolsFromIngestionResponse,
} from './DTO.js';

const logger = createLogger('RemoveSymbolsFromIngestionUseCase');

@injectable()
export class RemoveSymbolsFromIngestionUseCase {
  constructor(
    @inject(MARKET_DATA_TYPES.TradeStreamPort)
    private tradeStreamPort: TradeStreamPort,
    @inject(WORKER_MANAGEMENT_TYPES.WorkerManagementPort)
    private workerManagementPort: WorkerManagementPort
  ) {}

  async execute(
    request: RemoveSymbolsFromIngestionRequest
  ): Promise<RemoveSymbolsFromIngestionResponse> {
    try {
      logger.info(
        `Removing ${request.symbols.length} symbols from ingestion pipeline`,
        { symbols: request.symbols }
      );

      const results = await Promise.allSettled(
        request.symbols.map((symbol) => this.removeSymbolFromPipeline(symbol))
      );

      const processedResults = results.map((result, index) => {
        const symbol = request.symbols[index];
        if (result.status === 'fulfilled') {
          return {
            symbol,
            removed: result.value.removed,
            error: result.value.error,
          };
        } else {
          return {
            symbol,
            removed: false,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : 'Unknown error',
          };
        }
      });

      const removedSymbols = processedResults
        .filter((r) => r.removed)
        .map((r) => r.symbol);
      const notConnectedSymbols = processedResults
        .filter((r) => !r.removed && !r.error)
        .map((r) => r.symbol);

      logger.info(
        `Symbols removal completed: ${removedSymbols.length} removed, ${notConnectedSymbols.length} not connected`,
        {
          removedCount: removedSymbols.length,
          notConnectedCount: notConnectedSymbols.length,
          totalRequested: request.symbols.length,
          removedSymbols,
          notConnectedSymbols,
        }
      );

      const hasErrors = processedResults.some((r) => r.error);

      return {
        success: removedSymbols.length > 0 || !hasErrors,
        results: processedResults,
        removedSymbols,
        notConnectedSymbols,
        totalRequested: request.symbols.length,
        timestamp: new Date(),
        errors: hasErrors
          ? processedResults.filter((r) => r.error).map((r) => r.error!)
          : undefined,
      };
    } catch (error) {
      logger.error('Critical error during symbol removal', error);
      return {
        success: false,
        results: [],
        removedSymbols: [],
        notConnectedSymbols: [],
        totalRequested: request.symbols.length,
        timestamp: new Date(),
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  private async removeSymbolFromPipeline(
    symbol: string
  ): Promise<{ removed: boolean; error?: string }> {
    try {
      if (!symbol || typeof symbol !== 'string') {
        return { removed: false, error: 'Invalid symbol format' };
      }

      logger.debug(`Removing symbol ${symbol} from ingestion pipeline`);

      // Step 1: Unsubscribe from WebSocket stream first
      await this.tradeStreamPort.unsubscribeSymbols([symbol]);
      logger.debug(`Successfully unsubscribed WebSocket stream for ${symbol}`);

      // Step 2: Remove symbol from worker assignment
      try {
        await this.workerManagementPort.removeSymbolFromWorker(symbol);
        logger.debug(`Successfully removed symbol ${symbol} from worker`);
      } catch (removeError) {
        logger.warn(
          `Failed to remove symbol ${symbol} from worker`,
          removeError
        );
        // Continue anyway - symbol is already unsubscribed from WebSocket
      }

      return { removed: true };
    } catch (error) {
      logger.error(`Failed to remove symbol ${symbol} from pipeline`, error);
      return {
        removed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
