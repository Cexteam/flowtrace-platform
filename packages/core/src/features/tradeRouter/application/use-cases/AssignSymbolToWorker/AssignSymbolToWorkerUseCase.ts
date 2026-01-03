/**
 * Use Case: Assign Symbol To Worker
 * Business logic for symbol ownership assignment
 * Uses ConsistentHashRouter from workerManagement for unified hash algorithm
 */

import { inject, injectable } from 'inversify';
import { WORKER_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/workerManagement/types.js';
import type { WorkerPoolPort } from '../../../../workerManagement/application/ports/in/WorkerPoolPort.js';
import { ConsistentHashRouter } from '../../../../workerManagement/domain/services/ConsistentHashRouter.js';
import {
  AssignSymbolToWorkerRequest,
  AssignSymbolToWorkerResult,
} from './DTO.js';

@injectable()
export class AssignSymbolToWorkerUseCase {
  constructor(
    @inject(WORKER_MANAGEMENT_TYPES.WorkerPoolPort)
    private readonly workerPoolPort: WorkerPoolPort,
    @inject(WORKER_MANAGEMENT_TYPES.ConsistentHashRouter)
    private readonly consistentHashRouter: ConsistentHashRouter
  ) {}

  /**
   * Execute symbol assignment business logic
   */
  async execute(
    request: AssignSymbolToWorkerRequest
  ): Promise<AssignSymbolToWorkerResult> {
    const { symbol, workerId, force = false } = request;

    try {
      // 1. Validate symbol format
      if (!this.isValidSymbol(symbol)) {
        throw new Error(`Invalid symbol format: ${symbol}`);
      }

      // 2. Check current ownership using WorkerPoolPort
      const currentOwner = this.findWorkerBySymbol(symbol);

      // Already assigned and not forcing re-assignment
      if (currentOwner && !force) {
        return {
          success: true,
          symbol,
          assignedWorkerId: currentOwner,
          action: 'already_assigned',
          message: `Symbol ${symbol} is already assigned to worker ${currentOwner}`,
        };
      }

      // 3. Determine target worker using ConsistentHashRouter
      let targetWorkerId: string | null;

      if (workerId) {
        // Manual assignment specified
        targetWorkerId = workerId;
      } else {
        // Use ConsistentHashRouter for deterministic routing
        targetWorkerId = this.selectWorkerForSymbol(symbol);
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
      if (currentOwner && force && currentOwner !== targetWorkerId) {
        const oldWorker = this.workerPoolPort.getWorker(currentOwner);
        if (oldWorker) {
          oldWorker.removeSymbol(symbol);
        }
      }

      // 5. Assign to target worker
      const targetWorker = this.workerPoolPort.getWorker(targetWorkerId);
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
   * Find worker that owns a symbol using WorkerPoolPort
   */
  private findWorkerBySymbol(symbol: string): string | null {
    const workerIds = this.workerPoolPort.getWorkerIds();
    for (const workerId of workerIds) {
      const worker = this.workerPoolPort.getWorker(workerId);
      if (worker?.hasSymbol(symbol)) {
        return workerId;
      }
    }
    return null;
  }

  /**
   * Select optimal worker for symbol using ConsistentHashRouter
   */
  private selectWorkerForSymbol(symbol: string): string | null {
    try {
      const routingResult =
        this.consistentHashRouter.getWorkerForSymbol(symbol);
      return routingResult.workerId;
    } catch {
      // Fallback if ConsistentHashRouter has no workers
      const workerIds = this.workerPoolPort.getWorkerIds();
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
