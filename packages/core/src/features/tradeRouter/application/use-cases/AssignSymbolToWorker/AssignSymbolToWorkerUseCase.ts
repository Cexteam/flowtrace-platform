/**
 * Use Case: Assign Symbol To Worker
 * Business logic for symbol ownership assignment
 * Supports both manual assignment and consistent hashing
 */

import { inject, injectable } from 'inversify';
import { TRADE_ROUTER_TYPES } from '../../../../../shared/lib/di/bindings/features/tradeRouter/types.js';
import { WorkerRepository } from '../../../domain/repositories/WorkerRepository.js';
import {
  WorkerInfrastructureDrivenPort,
  SymbolAssignmentUpdate,
} from '../../../application/ports/out/WorkerInfrastructureDrivenPort.js';
import {
  AssignSymbolToWorkerRequest,
  AssignSymbolToWorkerResult,
} from './DTO.js';

@injectable()
export class AssignSymbolToWorkerUseCase {
  constructor(
    @inject(TRADE_ROUTER_TYPES.WorkerRepository)
    private readonly workerRepository: WorkerRepository,
    @inject(TRADE_ROUTER_TYPES.WorkerInfrastructureDrivenPort)
    private readonly workerInfrastructure: WorkerInfrastructureDrivenPort
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

      // 2. Check current ownership
      const currentOwners = await this.workerRepository.findWorkersBySymbol(
        symbol
      );

      // Already assigned and not forcing re-assignment
      if (currentOwners.length > 0 && !force) {
        const currentOwner = currentOwners[0]; // Take first if multiple (shouldn't happen)
        return {
          success: true,
          symbol,
          assignedWorkerId: currentOwner.id,
          action: 'already_assigned',
          message: `Symbol ${symbol} is already assigned to worker ${currentOwner.id}`,
        };
      }

      // 3. Determine target worker
      let targetWorkerId: string | null;

      if (workerId) {
        // Manual assignment specified
        targetWorkerId = workerId;
      } else {
        // Use consistent hashing to determine optimal worker
        targetWorkerId = await this.selectWorkerForSymbol(symbol);
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

      // 4. Remove from current owner(s) if re-assigning
      if (currentOwners.length > 0 && force) {
        for (const owner of currentOwners) {
          if (owner.id !== targetWorkerId) {
            // Remove from old worker
            await this.workerInfrastructure.updateWorkerAssignments(owner.id, {
              symbols: [symbol],
              action: 'remove',
              removedSymbols: [symbol],
            });
          }
        }
      }

      // 5. Assign to target worker
      await this.workerInfrastructure.updateWorkerAssignments(targetWorkerId, {
        symbols: [symbol],
        action: currentOwners.length > 0 && !force ? 'add' : 'replace',
      });

      // 6. Update repository state (main thread tracking)
      const targetWorker = await this.workerRepository.findById(targetWorkerId);
      if (targetWorker) {
        // Update domain state (stateful worker will handle persistence)
        await this.workerRepository.save(targetWorker);
      }

      const action = currentOwners.length > 0 ? 'reassigned' : 'assigned';

      return {
        success: true,
        symbol,
        assignedWorkerId: targetWorkerId,
        action: action as any,
        message: `Symbol ${symbol} ${action} to worker ${targetWorkerId}`,
      };
    } catch (error) {
      throw new Error(`Symbol assignment failed: ${(error as Error).message}`);
    }
  }

  /**
   * Select optimal worker for symbol using consistent hashing
   * PRIVATE: Business logic for worker selection
   */
  private async selectWorkerForSymbol(symbol: string): Promise<string | null> {
    try {
      // Get active workers for load balancing
      const activeWorkers = await this.workerRepository.findActiveWorkers();

      if (activeWorkers.length === 0) {
        return null;
      }

      if (activeWorkers.length === 1) {
        return activeWorkers[0].id;
      }

      // Simple consistent hashing: use symbol hash mod worker count
      const symbolHash = this.simpleHash(symbol);
      const selectedIndex = symbolHash % activeWorkers.length;
      const selectedWorkerId = activeWorkers[selectedIndex].id;

      return selectedWorkerId;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate symbol format
   * PRIVATE: Business rules for symbol validation
   */
  private isValidSymbol(symbol: string): boolean {
    // Business rules: symbols should be uppercase, alphanumeric
    // Allow 3-20 characters to support symbols like 1000PEPEUSDT, 1000SHIBUSDT
    if (!symbol || typeof symbol !== 'string') return false;

    const symbolRegex = /^[A-Z0-9]{3,20}$/;
    return symbolRegex.test(symbol);
  }

  /**
   * Simple hash function for consistent hashing
   * PRIVATE: Deterministic hashing for load balancing
   */
  private simpleHash(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
