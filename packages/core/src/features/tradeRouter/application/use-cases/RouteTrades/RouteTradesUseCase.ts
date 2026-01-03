/**
 * RouteTradesUseCase - CORRECTED IMPLEMENTATION
 * Simple deterministic routing respecting data ownership constraints
 *
 * Architecture Foundation: Symbol trades MUST go to worker owning CandlesOfSymbol data
 * Uses ConsistentHashRouter from workerManagement for unified hash algorithm
 *
 */

import { inject, injectable } from 'inversify';
import { WORKER_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/workerManagement/types.js';
import type { WorkerPoolPort } from '../../../../workerManagement/application/ports/in/WorkerPoolPort.js';
import type {
  WorkerCommunicationPort,
  WorkerMessage,
} from '../../../../workerManagement/application/ports/in/WorkerCommunicationPort.js';
import { ConsistentHashRouter } from '../../../../workerManagement/domain/services/ConsistentHashRouter.js';
import type {
  RouteTradesRequest,
  RouteTradesResult,
  RouteTradesError,
} from './DTO.js';

@injectable()
export class RouteTradesUseCase {
  constructor(
    @inject(WORKER_MANAGEMENT_TYPES.WorkerCommunicationPort)
    private workerCommunicationPort: WorkerCommunicationPort,
    @inject(WORKER_MANAGEMENT_TYPES.WorkerPoolPort)
    private workerPoolPort: WorkerPoolPort,
    @inject(WORKER_MANAGEMENT_TYPES.ConsistentHashRouter)
    private consistentHashRouter: ConsistentHashRouter
  ) {}

  /**
   * Execute trade routing - RESPECTING DATA OWNERSHIP
   */
  async execute(request: RouteTradesRequest): Promise<RouteTradesResult> {
    const startTime = Date.now();
    const { symbol, trades, priority = 'normal', batchId } = request;

    try {
      // Step 1: Validate business rules
      const validationError = this.validateRequest(request);
      if (validationError) {
        return this.createErrorResponse(symbol, validationError);
      }

      // Step 2: DETERMINISTIC OWNERSHIP - Find worker owning this symbol's data
      // Uses ConsistentHashRouter - same symbol ALWAYS goes to same worker
      const targetWorkerId = this.getOwnerWorker(symbol);
      if (!targetWorkerId) {
        return this.createErrorResponse(
          symbol,
          'No worker available for symbol ownership'
        );
      }

      // Step 3: Send trades to OWNER worker (data integrity preserved)
      const messageData: WorkerMessage = {
        id: `trade_${Date.now()}_${Math.random()}`,
        type: 'PROCESS_TRADES',
        data: {
          symbol,
          trades,
          options: {
            priority,
            batchId,
            timestamp: new Date(),
          },
        },
        timestamp: new Date(),
      };

      await this.workerCommunicationPort.sendToWorker(
        targetWorkerId,
        messageData
      );

      // Step 4: Return success response
      const processingTime = Date.now() - startTime;
      return {
        success: true,
        workerId: targetWorkerId,
        processingTime,
        symbol,
        tradeCount: trades.length,
        batchId: batchId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown routing error';
      return this.createErrorResponse(symbol, errorMessage);
    }
  }

  // ===== ROUTING METHODS =====

  /**
   * DETERMINISTIC OWNERSHIP: Get worker owning this symbol's CandlesOfSymbol data
   * Uses ConsistentHashRouter for unified hash algorithm (DJB2 + virtual nodes)
   */
  private getOwnerWorker(symbol: string): string | null {
    try {
      const routingResult =
        this.consistentHashRouter.getWorkerForSymbol(symbol);
      return routingResult.workerId;
    } catch {
      // Fallback if ConsistentHashRouter has no workers
      const allWorkers = this.workerPoolPort.getWorkerIds();
      if (allWorkers.length === 0) return null;
      return allWorkers[0];
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Validate trade routing request
   */
  private validateRequest(request: RouteTradesRequest): string | null {
    const { symbol, trades } = request;

    if (!symbol?.trim()) {
      return 'Symbol is required and cannot be empty';
    }

    if (!Array.isArray(trades) || trades.length === 0) {
      return 'Trades must be a non-empty array';
    }

    if (trades.length > 10000) {
      return 'Trade batch too large (max 10000 trades per batch)';
    }

    return null;
  }

  /**
   * Create error response
   */
  private createErrorResponse(symbol: string, error: string): RouteTradesError {
    return {
      success: false,
      symbol,
      error,
      timestamp: new Date(),
    };
  }
}
