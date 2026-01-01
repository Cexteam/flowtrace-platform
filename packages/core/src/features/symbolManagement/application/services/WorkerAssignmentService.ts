/**
 * Worker Assignment Service - Application Layer
 * Orchestrates use cases for worker assignment operations
 * Follows hexagonal architecture: Service → Use Cases → Repository
 */

import { injectable, inject } from 'inversify';
import { createLogger } from '../../../../shared/lib/logger/logger.js';
import {
  WorkerAssignmentServicePort,
  type WorkerAssignment,
} from '../ports/in/WorkerAssignmentServicePort.js';
import { AssignSymbolToWorkerUseCase } from '../use-cases/AssignSymbolToWorker/index.js';
import { FindAssignmentsByWorkerUseCase } from '../use-cases/FindAssignmentsByWorker/index.js';
import { FindAssignmentsByExchangeUseCase } from '../use-cases/FindAssignmentsByExchange/index.js';
import { GetAssignmentUseCase } from '../use-cases/GetAssignment/index.js';
import { RemoveAssignmentUseCase } from '../use-cases/RemoveAssignment/index.js';
import { SYMBOL_MANAGEMENT_TYPES } from '../../../../shared/lib/di/bindings/features/symbolManagement/types.js';

const logger = createLogger('WorkerAssignmentService');

@injectable()
export class WorkerAssignmentService implements WorkerAssignmentServicePort {
  constructor(
    @inject(SYMBOL_MANAGEMENT_TYPES.AssignSymbolToWorkerUseCase)
    private assignSymbolUseCase: AssignSymbolToWorkerUseCase,
    @inject(SYMBOL_MANAGEMENT_TYPES.FindAssignmentsByWorkerUseCase)
    private findByWorkerUseCase: FindAssignmentsByWorkerUseCase,
    @inject(SYMBOL_MANAGEMENT_TYPES.FindAssignmentsByExchangeUseCase)
    private findByExchangeUseCase: FindAssignmentsByExchangeUseCase,
    @inject(SYMBOL_MANAGEMENT_TYPES.GetAssignmentUseCase)
    private getAssignmentUseCase: GetAssignmentUseCase,
    @inject(SYMBOL_MANAGEMENT_TYPES.RemoveAssignmentUseCase)
    private removeAssignmentUseCase: RemoveAssignmentUseCase
  ) {}
  /**
   * Assign a symbol to a worker using consistent hashing
   * Orchestrates AssignSymbolToWorkerUseCase
   */
  async assignSymbolToWorker(
    symbol: string,
    exchange: string,
    totalWorkers: number
  ): Promise<number> {
    try {
      const result = await this.assignSymbolUseCase.execute({
        symbol,
        exchange,
        totalWorkers,
      });

      logger.debug(
        `Assigned ${result.assignment.symbolKey} to worker ${result.workerId} (total workers: ${totalWorkers})`
      );

      return result.workerId;
    } catch (error) {
      logger.error(
        `Failed to assign symbol ${exchange}:${symbol} to worker:`,
        error
      );
      throw error;
    }
  }

  /**
   * Find worker assignments by worker ID
   * Delegates to FindAssignmentsByWorkerUseCase
   */
  async findByWorker(workerId: number): Promise<WorkerAssignment[]> {
    return this.findByWorkerUseCase.execute(workerId);
  }

  /**
   * Find worker assignments by exchange
   * Delegates to FindAssignmentsByExchangeUseCase
   */
  async findByExchange(exchange: string): Promise<WorkerAssignment[]> {
    return this.findByExchangeUseCase.execute(exchange);
  }

  /**
   * Remove worker assignment for a symbol
   * Delegates to RemoveAssignmentUseCase
   */
  async removeAssignment(symbol: string, exchange: string): Promise<void> {
    try {
      await this.removeAssignmentUseCase.execute({ symbol, exchange });
      logger.debug(`Removed assignment for ${exchange}:${symbol}`);
    } catch (error) {
      logger.error(
        `Failed to remove assignment for ${exchange}:${symbol}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get assignment for a specific symbol
   * Delegates to GetAssignmentUseCase
   */
  async getAssignment(
    symbol: string,
    exchange: string
  ): Promise<WorkerAssignment | null> {
    return this.getAssignmentUseCase.execute({ symbol, exchange });
  }
}
