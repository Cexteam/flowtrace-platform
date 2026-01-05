/**
 * Use Case: Remove Symbol From Worker
 * Business logic for symbol ownership removal and cleanup
 */

import { injectable } from 'inversify';
import type { WorkerThread } from '../../../domain/entities/WorkerThread.js';
import type {
  RemoveSymbolFromWorkerRequest,
  RemoveSymbolFromWorkerResult,
} from './DTO.js';

@injectable()
export class RemoveSymbolFromWorkerUseCase {
  async execute(
    request: RemoveSymbolFromWorkerRequest
  ): Promise<RemoveSymbolFromWorkerResult> {
    const { symbol, workerId, workers } = request;

    try {
      if (!this.isValidSymbol(symbol)) {
        throw new Error(`Invalid symbol: ${symbol}`);
      }

      // Find current owner
      const currentOwner = this.findWorkerBySymbol(symbol, workers);

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
      if (workerId && currentOwner.workerId !== workerId) {
        return {
          success: false,
          symbol,
          removedFromWorkerId: workerId,
          action: 'not_owned_by_specified_worker',
          message: `Worker ${workerId} doesn't own ${symbol}`,
        };
      }

      const targetWorkerId = workerId || currentOwner.workerId;

      // Remove symbol from worker
      currentOwner.removeSymbol(symbol);

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

  private isValidSymbol(symbol: string): boolean {
    if (!symbol || typeof symbol !== 'string') return false;
    // Allow 3-30 characters to support:
    // - Regular symbols: BTCUSDT, 1000PEPEUSDT, 1000SHIBUSDT
    // - Quarterly futures: BTCUSDT_260327, ETHUSDT_260626
    const symbolRegex = /^[A-Z0-9_]{3,30}$/;
    return symbolRegex.test(symbol);
  }
}
