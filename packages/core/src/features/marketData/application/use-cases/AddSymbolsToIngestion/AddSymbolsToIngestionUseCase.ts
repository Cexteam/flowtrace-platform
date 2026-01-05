import { inject, injectable } from 'inversify';
import { MARKET_DATA_TYPES } from '../../../../../shared/lib/di/bindings/features/marketData/types.js';
import { WORKER_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/workerManagement/types.js';
import { TradeStreamPort } from '../../../application/ports/out/TradeStreamPort.js';
import { WorkerManagementPort } from '../../../../workerManagement/application/ports/in/WorkerManagementPort.js';
import { createLogger } from '../../../../../shared/lib/logger/logger.js';
import type {
  AddSymbolsToIngestionRequest,
  AddSymbolsToIngestionResponse,
} from './DTO.js';

const logger = createLogger('AddSymbolsToIngestionUseCase');

@injectable()
export class AddSymbolsToIngestionUseCase {
  constructor(
    @inject(MARKET_DATA_TYPES.TradeStreamPort)
    private tradeStreamPort: TradeStreamPort,
    @inject(WORKER_MANAGEMENT_TYPES.WorkerManagementPort)
    private workerManagementPort: WorkerManagementPort
  ) {}

  async execute(
    request: AddSymbolsToIngestionRequest
  ): Promise<AddSymbolsToIngestionResponse> {
    try {
      logger.info(
        `Adding ${request.symbols.length} symbols to ingestion pipeline`,
        { symbols: request.symbols, skipExisting: request.skipExisting }
      );

      const results = await Promise.allSettled(
        request.symbols.map((symbol) =>
          this.addSymbolToPipeline(symbol, request)
        )
      );

      const processedResults = results.map((result, index) => {
        const symbol = request.symbols[index];
        if (result.status === 'fulfilled') {
          return {
            symbol,
            added: result.value.added,
            error: result.value.error,
          };
        } else {
          return {
            symbol,
            added: false,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : 'Unknown error',
          };
        }
      });

      const addedSymbols = processedResults
        .filter((r) => r.added)
        .map((r) => r.symbol);
      const skippedSymbols = processedResults
        .filter((r) => !r.added && !r.error)
        .map((r) => r.symbol);

      logger.info(
        `Symbols addition completed: ${addedSymbols.length} added, ${skippedSymbols.length} skipped`,
        {
          addedCount: addedSymbols.length,
          skippedCount: skippedSymbols.length,
          totalRequested: request.symbols.length,
          addedSymbols,
          skippedSymbols,
        }
      );

      const hasErrors = processedResults.some((r) => r.error);

      return {
        success: addedSymbols.length > 0,
        results: processedResults,
        addedSymbols,
        skippedSymbols,
        totalRequested: request.symbols.length,
        timestamp: new Date(),
        errors: hasErrors
          ? processedResults.filter((r) => r.error).map((r) => r.error!)
          : undefined,
      };
    } catch (error) {
      logger.error('Critical error during symbol addition', error);
      return {
        success: false,
        results: [],
        addedSymbols: [],
        skippedSymbols: [],
        totalRequested: request.symbols.length,
        timestamp: new Date(),
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  private async addSymbolToPipeline(
    symbol: string,
    request: AddSymbolsToIngestionRequest
  ): Promise<{ added: boolean; error?: string }> {
    try {
      if (!symbol || typeof symbol !== 'string') {
        return { added: false, error: 'Invalid symbol format' };
      }

      logger.debug(`Adding symbol ${symbol} to ingestion pipeline`);

      // Step 1: Assign symbol to worker BEFORE subscribing to WebSocket
      // This ensures the worker is ready to receive trades when they arrive
      try {
        await this.workerManagementPort.assignSymbolToWorker(symbol);
        logger.debug(`Successfully assigned symbol ${symbol} to worker`);
      } catch (assignError) {
        logger.warn(
          `Failed to assign symbol ${symbol} to worker, continuing with subscription`,
          assignError
        );
        // Continue anyway - RouteTradesUseCase will handle assignment on first trade
      }

      // Step 2: Subscribe to WebSocket stream
      await this.tradeStreamPort.subscribeSymbols([symbol]);
      logger.debug(`Successfully subscribed WebSocket stream for ${symbol}`);

      return { added: true };
    } catch (error) {
      logger.error(`Failed to add symbol ${symbol} to pipeline`, error);
      return {
        added: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
