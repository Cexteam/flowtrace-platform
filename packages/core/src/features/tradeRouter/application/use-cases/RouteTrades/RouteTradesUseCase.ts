/**
 * RouteTradesUseCase - CORRECTED IMPLEMENTATION
 * Simple deterministic routing respecting data ownership constraints
 *
 * Architecture Foundation: Symbol trades MUST go to worker owning CandlesOfSymbol data
 * No "intelligent" load balancing that breaks memory ownership!
 *
 */

import { inject, injectable } from 'inversify';
import { TRADE_ROUTER_TYPES } from '../../../../../shared/lib/di/bindings/features/tradeRouter/types.js';
import { WORKER_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/workerManagement/types.js';
import type { WorkerInfrastructureDrivenPort } from '../../ports/out/WorkerInfrastructureDrivenPort.js';
import type { WorkerPoolPort } from '../../../../workerManagement/application/ports/in/WorkerPoolPort.js';
import type {
  RouteTradesRequest,
  RouteTradesResult,
  RouteTradesSuccess,
  RouteTradesError,
} from './DTO.js';

// Import WorkerMessage type from the port definition
import type { WorkerMessage } from '../../ports/out/WorkerInfrastructureDrivenPort.js';

@injectable()
export class RouteTradesUseCase {
  constructor(
    @inject(TRADE_ROUTER_TYPES.WorkerInfrastructureDrivenPort)
    private workerInfrastructure: WorkerInfrastructureDrivenPort,
    @inject(WORKER_MANAGEMENT_TYPES.WorkerPoolPort)
    private workerPoolPort: WorkerPoolPort
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
      // Uses consistent hashing - same symbol ALWAYS goes to same worker
      const targetWorkerId = this.getOwnerWorker(symbol);
      if (!targetWorkerId) {
        return this.createErrorResponse(
          symbol,
          'No worker available for symbol ownership'
        );
      }

      // NOTE: Removed health-aware failover to prevent data inconsistency
      // Health check was causing trades to be sent to different workers
      // when primary worker was temporarily slow to respond

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

      const response = await this.workerInfrastructure.sendToWorker(
        targetWorkerId,
        messageData
      );

      // Step 5: Return success response
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

  // ===== CORRECT ALGORITHM METHODS =====

  /**
   * DETERMINISTIC OWNERSHIP: Get worker owning this symbol's CandlesOfSymbol data
   * Uses WorkerPoolPort for worker management (Requirement 7.4)
   */
  private getOwnerWorker(symbol: string): string | null {
    const allWorkers = this.workerPoolPort.getWorkerIds();
    if (allWorkers.length === 0) return null;

    // CONSISTENT HASHING: Same symbol ALWAYS routes to same worker
    // This ensures CandlesOfSymbol ownership consistency
    allWorkers.sort(); // Deterministic sorting
    const hash = this.simpleHash(symbol);
    const ownerIndex = hash % allWorkers.length;

    return allWorkers[ownerIndex];
  }

  /**
   * HEALTH-AWARE FAILOVER: If primary owner is down, find backup worker
   * Uses WorkerPoolPort for worker management (Requirement 7.4)
   */
  private getBackupWorker(
    symbol: string,
    failedWorkerId: string
  ): string | null {
    const allWorkers = this.workerPoolPort.getWorkerIds();
    const healthyWorkers = allWorkers.filter((id) => id !== failedWorkerId);

    if (healthyWorkers.length === 0) return null;

    // Rerun ownership algorithm excluding failed worker
    // Backup worker automatically becomes owner of this symbol
    healthyWorkers.sort(); // Deterministic
    const hash = this.simpleHash(symbol);
    const backupIndex = hash % healthyWorkers.length;

    return healthyWorkers[backupIndex];
  }

  /**
   * Simple hash function for consistent routing
   */
  private simpleHash(key: string): number {
    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = (hash << 5) + hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 0xffffffff;
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
