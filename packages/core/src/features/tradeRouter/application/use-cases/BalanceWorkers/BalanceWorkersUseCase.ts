/**
 * Use Case: Balance Workers Load
 * Monitors and balances symbol assignments across workers
 * Called periodically or when load становится imbalanced
 */

import { inject, injectable } from 'inversify';
import { TRADE_ROUTER_TYPES } from '../../../../../shared/lib/di/bindings/features/tradeRouter/types.js';
import { WorkerRepository } from '../../../domain/repositories/WorkerRepository.js';
import { WorkerInfrastructureDrivenPort } from '../../../application/ports/out/WorkerInfrastructureDrivenPort.js';
import type { BalanceWorkersRequest, BalanceWorkersResult } from './DTO.js';

@injectable()
export class BalanceWorkersUseCase {
  constructor(
    @inject(TRADE_ROUTER_TYPES.WorkerRepository)
    private readonly workerRepository: WorkerRepository,
    @inject(TRADE_ROUTER_TYPES.WorkerInfrastructureDrivenPort)
    private readonly workerInfrastructure: WorkerInfrastructureDrivenPort
  ) {}

  async execute(request: BalanceWorkersRequest): Promise<BalanceWorkersResult> {
    const { maxSymbolsPerWorker = 100 } = request;

    try {
      console.log('Checking worker load balance...');

      // Get current load distribution
      const systemLoad = await this.workerInfrastructure.getRoutingSystemLoad();
      const workersWithSymbols = systemLoad.symbolsPerWorker;

      if (workersWithSymbols.length === 0) {
        return {
          success: true,
          totalWorkersAffected: 0,
          symbolsReassigned: 0,
          balanceScoreBefore: 100,
          balanceScoreAfter: 100,
          message: 'No workers with symbol assignments to balance',
        };
      }

      // Calculate current balance score
      const symbolCounts = workersWithSymbols.map((w) => w.symbolCount);
      const balanceScoreBefore = this.calculateBalanceScore(symbolCounts);

      // For now, just monitor - actual balancing requires complex worker coordination
      // This is a placeholder for future load balancing implementation

      console.log(
        `Worker load balance checked. Current score: ${balanceScoreBefore}%`
      );

      return {
        success: true,
        totalWorkersAffected: 0, // No actual balancing done
        symbolsReassigned: 0, // yet
        balanceScoreBefore,
        balanceScoreAfter: balanceScoreBefore,
        message: `Load balance analyzed: ${balanceScoreBefore}% balanced (monitoring mode)`,
      };
    } catch (error) {
      console.error('BalanceWorkers error:', error);
      return {
        success: false,
        totalWorkersAffected: 0,
        symbolsReassigned: 0,
        balanceScoreBefore: 0,
        balanceScoreAfter: 0,
        message: `Balance check failed: ${(error as Error).message}`,
      };
    }
  }

  private calculateBalanceScore(symbolCounts: number[]): number {
    if (symbolCounts.length <= 1) return 100;

    const avg =
      symbolCounts.reduce((sum, count) => sum + count, 0) / symbolCounts.length;
    const variance =
      symbolCounts.reduce((sum, count) => sum + Math.pow(count - avg, 2), 0) /
      symbolCounts.length;
    const stdDev = Math.sqrt(variance);

    // Perfect balance = 100%, high variance = lower score
    const normalizedVariance = Math.min(stdDev / Math.max(avg, 1), 2); // Cap at 200% variance
    const balanceScore = Math.max(0, 100 - normalizedVariance * 50);

    return Math.round(balanceScore);
  }
}
