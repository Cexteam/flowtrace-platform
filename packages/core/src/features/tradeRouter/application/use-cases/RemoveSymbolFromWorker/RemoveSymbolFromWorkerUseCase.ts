/**
 * Use Case: Remove Symbol From Worker
 * Business logic for symbol ownership removal and cleanup
 */

import { inject, injectable } from 'inversify';
import { TRADE_ROUTER_TYPES } from '../../../../../shared/lib/di/bindings/features/tradeRouter/types.js';
import { WorkerRepository } from '../../../domain/repositories/WorkerRepository.js';
import { WorkerInfrastructureDrivenPort } from '../../../application/ports/out/WorkerInfrastructureDrivenPort.js';
import {
  RemoveSymbolFromWorkerRequest,
  RemoveSymbolFromWorkerResult,
} from './DTO.js';

@injectable()
export class RemoveSymbolFromWorkerUseCase {
  constructor(
    @inject(TRADE_ROUTER_TYPES.WorkerRepository)
    private readonly workerRepository: WorkerRepository,
    @inject(TRADE_ROUTER_TYPES.WorkerInfrastructureDrivenPort)
    private readonly workerInfrastructure: WorkerInfrastructureDrivenPort
  ) {}

  async execute(
    request: RemoveSymbolFromWorkerRequest
  ): Promise<RemoveSymbolFromWorkerResult> {
    const { symbol, workerId, force = false } = request;

    try {
      if (!this.isValidSymbol(symbol)) {
        throw new Error(`Invalid symbol: ${symbol}`);
      }

      const currentOwners = await this.workerRepository.findWorkersBySymbol(
        symbol
      );

      if (currentOwners.length === 0) {
        return {
          success: true,
          symbol,
          removedFromWorkerId: '',
          action: 'not_found',
          message: `Symbol ${symbol} not found`,
        };
      }

      let targetWorkerId: string;
      if (workerId) {
        const target = currentOwners.find((o) => o.id === workerId);
        if (!target) {
          return {
            success: false,
            symbol,
            removedFromWorkerId: workerId,
            action: 'not_owned_by_specified_worker',
            message: `Worker ${workerId} doesn't own ${symbol}`,
          };
        }
        targetWorkerId = workerId;
      } else {
        targetWorkerId = currentOwners[0].id;
      }

      await this.workerInfrastructure.updateWorkerAssignments(targetWorkerId, {
        symbols: [symbol],
        action: 'remove',
        removedSymbols: [symbol],
      });

      const owner = await this.workerRepository.findById(targetWorkerId);
      if (owner) {
        await this.workerRepository.save(owner);
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

  private isValidSymbol(symbol: string): boolean {
    if (!symbol || typeof symbol !== 'string') return false;
    // Allow 3-20 characters to support symbols like 1000PEPEUSDT, 1000SHIBUSDT
    const symbolRegex = /^[A-Z0-9]{3,20}$/;
    return symbolRegex.test(symbol);
  }
}
