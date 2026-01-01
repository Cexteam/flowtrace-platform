/**
 * SendTradeToWorkerUseCase - Application use case for routing trades to workers
 *
 * Handles the logic for routing trades to the appropriate worker based on
 * consistent hashing of the symbol.
 *
 */

import { injectable, inject } from 'inversify';
import { WORKER_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/workerManagement/types.js';
import { WorkerCommunicationPort } from '../../ports/in/WorkerCommunicationPort.js';
import { ConsistentHashRouter } from '../../../domain/services/ConsistentHashRouter.js';
import { SendTradeToWorkerRequest, SendTradeToWorkerResult } from './DTO.js';
import { createLogger } from '../../../../../shared/lib/logger/logger.js';

const logger = createLogger('SendTradeToWorkerUseCase');

/**
 * SendTradeToWorkerUseCase - Routes trades to appropriate workers
 */
@injectable()
export class SendTradeToWorkerUseCase {
  constructor(
    @inject(WORKER_MANAGEMENT_TYPES.WorkerCommunicationPort)
    private communicationPort: WorkerCommunicationPort,

    @inject(WORKER_MANAGEMENT_TYPES.ConsistentHashRouter)
    private router: ConsistentHashRouter
  ) {}

  /**
   * Execute the send trade to worker use case
   *
   * @param request - Send trade request
   * @returns Result of the trade processing
   */
  async execute(
    request: SendTradeToWorkerRequest
  ): Promise<SendTradeToWorkerResult> {
    const startTime = Date.now();

    try {
      // Get the worker responsible for this symbol
      const routingResult = this.router.getWorkerForSymbol(request.symbol);
      const workerId = routingResult.workerId;

      logger.debug(
        `Routing ${request.trades.length} trades for ${request.symbol} to worker ${workerId}`
      );

      // Send trades to the worker
      const response = await this.communicationPort.sendTrades(
        workerId,
        request.symbol,
        request.trades,
        request.config
      );

      const processingTimeMs = Date.now() - startTime;

      if (!response.success) {
        return {
          success: false,
          symbol: request.symbol,
          workerId,
          processedTrades: 0,
          eventsPublished: 0,
          processingTimeMs,
          error: response.error || 'Unknown error',
        };
      }

      const result = response.result as {
        processedTrades?: number;
        eventsPublished?: number;
        metadata?: {
          candlesUpdated: number;
          timeframeRollups: string[];
        };
      };

      return {
        success: true,
        symbol: request.symbol,
        workerId,
        processedTrades: result?.processedTrades || request.trades.length,
        eventsPublished: result?.eventsPublished || 0,
        processingTimeMs,
        metadata: result?.metadata,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      logger.error(
        `Failed to send trades for ${request.symbol}: ${errorMessage}`
      );

      return {
        success: false,
        symbol: request.symbol,
        workerId: 'unknown',
        processedTrades: 0,
        eventsPublished: 0,
        processingTimeMs: Date.now() - startTime,
        error: errorMessage,
      };
    }
  }
}
