/**
 * Use Case: Remove Symbol From Worker
 * Business logic for symbol ownership removal and cleanup
 * Uses WorkerPoolPort from workerManagement directly
 */

import { inject, injectable } from 'inversify';
import { WORKER_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/workerManagement/types.js';
import type { WorkerPoolPort } from '../../../../workerManagement/application/ports/in/WorkerPoolPort.js';
import {
  RemoveSymbolFromWorkerRequest,
  RemoveSymbolFromWorkerResult,
} from './DTO.js';

@injectable()
export class RemoveSymbolFromWorkerUseCase {
  constructor(
    @inject(WORKER_MANAGEMENT_TYPES.WorkerPoolPort)
    private readonly workerPoolPort: WorkerPoolPort
  ) {}

  async execute(
    request: RemoveSymbolFromWorkerRequest
  ): Promise<RemoveSymbolFromWorkerResult> {
    const { symbol, workerId } = request;

    try {
      if (!this.isValidSymbol(symbol)) {
        throw new Error(`Invalid symbol: ${symbol}`);
      }

      // Find current owner using WorkerPoolPort
      const currentOwner = this.findWorkerBySymbol(symbol);

      if (!currentOwner) {
        return {
          success: true,
          symbol,
          removedFromWorkerId: '',
          action: 'not_found',
          message: `Symbol ${symbol} not found`,
        };
      }

      // If specific worker requested, verify ownership
      if (workerId && currentOwner !== workerId) {
        return {
          success: false,
          symbol,
          removedFromWorkerId: workerId,
          action: 'not_owned_by_specified_worker',
          message: `Worker ${workerId} doesn't own ${symbol}`,
        };
      }

      const targetWorkerId = workerId || currentOwner;

      // Remove symbol from worker via WorkerPoolPort
      const worker = this.workerPoolPort.getWorker(targetWorkerId);
      if (worker) {
        worker.removeSymbol(symbol);
      }

      return {
        success: true,
        symbol,
        removedFromWorkerId: targetWorkerId,
        action: 'removed',
        message: `Removed ${symbol} from worker ${targetWorkerId}`,
      };
    } catch (error) {
      console.error('RemoveSymbolFromWorker error:', error);
      throw error;
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

  private isValidSymbol(symbol: string): boolean {
    if (!symbol || typeof symbol !== 'string') return false;
    // Allow 3-30 characters to support:
    // - Regular symbols: BTCUSDT, 1000PEPEUSDT, 1000SHIBUSDT
    // - Quarterly futures: BTCUSDT_260327, ETHUSDT_260626
    const symbolRegex = /^[A-Z0-9_]{3,30}$/;
    return symbolRegex.test(symbol);
  }
}
