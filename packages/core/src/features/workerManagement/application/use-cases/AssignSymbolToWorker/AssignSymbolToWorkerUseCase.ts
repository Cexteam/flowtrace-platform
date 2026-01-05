/**
 * Use Case: Assign Symbol To Worker
 * Business logic for symbol ownership assignment
 * Uses ConsistentHashRouter for unified hash algorithm
 */

import { inject, injectable } from 'inversify';
import { WORKER_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/workerManagement/types.js';
import { ConsistentHashRouter } from '../../../domain/services/ConsistentHashRouter.js';
import type { WorkerThread } from '../../../domain/entities/WorkerThread.js';
import type {
  AssignSymbolToWorkerRequest,
  AssignSymbolToWorkerResult,
} from './DTO.js';

@injectable()
export class AssignSymbolToWorkerUseCase {
  constructor(
    @inject(WORKER_MANAGEMENT_TYPES.ConsistentHashRouter)
    private readonly consistentHashRouter: ConsistentHashRouter
  ) {}

  /**
   * Execute symbol assignment business logic
   */
  async execute(
    request: AssignSymbolToWorkerRequest
  ): Promise<AssignSymbolToWorkerResult> {
    const { symbol, workerId, force = false, workers } = request;

    try {
      // 1. Validate symbol format
      if (!this.isValidSymbol(symbol)) {
        throw new Error(`Invalid symbol format: ${symbol}`);
      }

      // 2. Check current ownership
      const currentOwner = this.findWorkerBySymbol(symbol, workers);

      // Already assigned and not forcing re-assignment
      if (currentOwner && !force) {
        return {
          success: true,
          symbol,
          assignedWorkerId: currentOwner.workerId,
          action: 'already_assigned',
          message: `Symbol ${symbol} is already assigned to worker ${currentOwner.workerId}`,
        };
      }

      // 3. Determine target worker using ConsistentHashRouter
      let targetWorkerId: string | null;

      if (workerId) {
        // Manual assignment specified
        targetWorkerId = workerId;
      } else {
        // Use ConsistentHashRouter for deterministic routing
        targetWorkerId = this.selectWorkerForSymbol(symbol, workers);
      }

      if (!targetWorkerId) {
        return {
          success: false,
          symbol,
          assignedWorkerId: '',
          action: 'no_workers_available',
          message: `No suitable worker found for symbol ${symbol}`,
        };
      }

      // 4. Remove from current owner if re-assigning
      if (currentOwner && force && currentOwner.workerId !== targetWorkerId) {
        currentOwner.removeSymbol(symbol);
      }

      // 5. Assign to target worker
      const targetWorker = workers.get(targetWorkerId);
      if (targetWorker) {
        targetWorker.assignSymbol(symbol);
      }

      const action = currentOwner ? 'reassigned' : 'assigned';

      return {
        success: true,
        symbol,
        assignedWorkerId: targetWorkerId,
        action: action as 'assigned' | 'reassigned',
        message: `Symbol ${symbol} ${action} to worker ${targetWorkerId}`,
      };
    } catch (error) {
      throw new Error(`Symbol assignment failed: ${(error as Error).message}`);
    }
  }

  /**
   * Find worker that owns a symbol
   */
  private findWorkerBySymbol(
    symbol: string,
    workers: Map<string, WorkerThread>
  ): WorkerThread | null {
    for (const worker of workers.values()) {
      if (worker.hasSymbol(symbol)) {
        return worker;
      }
    }
    return null;
  }

  /**
   * Select optimal worker for symbol using ConsistentHashRouter
   */
  private selectWorkerForSymbol(
    symbol: string,
    workers: Map<string, WorkerThread>
  ): string | null {
    try {
      const routingResult =
        this.consistentHashRouter.getWorkerForSymbol(symbol);
      return routingResult.workerId;
    } catch {
      // Fallback if ConsistentHashRouter has no workers
      const workerIds = Array.from(workers.keys());
      if (workerIds.length === 0) return null;
      return workerIds[0];
    }
  }

  /**
   * Validate symbol format
   */
  private isValidSymbol(symbol: string): boolean {
    if (!symbol || typeof symbol !== 'string') return false;
    // Allow 3-30 characters to support:
    // - Regular symbols: BTCUSDT, 1000PEPEUSDT, 1000SHIBUSDT
    // - Quarterly futures: BTCUSDT_260327, ETHUSDT_260626
    const symbolRegex = /^[A-Z0-9_]{3,30}$/;
    return symbolRegex.test(symbol);
  }
}
