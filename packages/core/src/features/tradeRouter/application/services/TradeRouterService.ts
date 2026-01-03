/**
 * Trade Router Service - Application Layer Implementation
 * Implements TradeRouterDrivingPort interface
 *
 * Extended to include worker pool management methods so that marketData
 * doesn't need to import from workerManagement directly.
 */

import { injectable, inject } from 'inversify';
import { TRADE_ROUTER_TYPES } from '../../../../shared/lib/di/bindings/features/tradeRouter/types.js';
import { WORKER_MANAGEMENT_TYPES } from '../../../../shared/lib/di/bindings/features/workerManagement/types.js';
import {
  TradeRouterDrivingPort,
  InitializeSymbolRoutingResult,
  WorkerPoolConfig,
  WorkerPoolStatus,
} from '../ports/in/TradeRouterDrivingPort.js';
import type {
  RouteTradesUseCase,
  RouteTradesRequest,
} from '../use-cases/RouteTrades/index.js';
import type { AssignSymbolToWorkerUseCase } from '../use-cases/AssignSymbolToWorker/index.js';
import type { RemoveSymbolFromWorkerUseCase } from '../use-cases/RemoveSymbolFromWorker/index.js';
import type { WorkerPoolPort } from '../../../workerManagement/application/ports/in/WorkerPoolPort.js';
import type { WorkerCommunicationPort } from '../../../workerManagement/application/ports/in/WorkerCommunicationPort.js';
import { ConsistentHashRouter } from '../../../workerManagement/domain/services/ConsistentHashRouter.js';
import { createLogger } from '../../../../shared/lib/logger/logger.js';

const logger = createLogger('TradeRouterService');

@injectable()
export class TradeRouterService implements TradeRouterDrivingPort {
  constructor(
    @inject(TRADE_ROUTER_TYPES.RouteTradesUseCase)
    private routeTradesUseCase: RouteTradesUseCase,
    @inject(TRADE_ROUTER_TYPES.AssignSymbolToWorkerUseCase)
    private assignSymbolUseCase: AssignSymbolToWorkerUseCase,
    @inject(TRADE_ROUTER_TYPES.RemoveSymbolFromWorkerUseCase)
    private removeSymbolUseCase: RemoveSymbolFromWorkerUseCase,
    @inject(WORKER_MANAGEMENT_TYPES.WorkerPoolPort)
    private workerPoolPort: WorkerPoolPort,
    @inject(WORKER_MANAGEMENT_TYPES.WorkerCommunicationPort)
    private workerCommunicationPort: WorkerCommunicationPort,
    @inject(WORKER_MANAGEMENT_TYPES.ConsistentHashRouter)
    private consistentHashRouter: ConsistentHashRouter
  ) {}

  // ============ Core Trade Routing ============

  /**
   * Core routing functionality - Delegate to Use Case
   */
  async routeTrades(
    symbol: string,
    trades: any[],
    options?: {
      priority?: 'urgent' | 'normal';
      batchId?: string;
    }
  ): Promise<any> {
    const request: RouteTradesRequest = {
      symbol,
      trades,
      priority: options?.priority,
      batchId: options?.batchId,
      timestamp: new Date(),
    };

    try {
      const result = await this.routeTradesUseCase.execute(request);

      if (result.success) {
        return result;
      } else {
        throw new Error(
          `Routing failed for symbol ${result.symbol}: ${result.error}`
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown routing error';
      logger.error(`TradeRouterService routeTrades failed: ${errorMessage}`);
      throw error;
    }
  }

  // ============ Symbol Management ============

  /**
   * Symbol management - Delegate to AssignSymbolToWorker use case
   */
  async assignSymbolToWorker(symbol: string, workerId?: string): Promise<void> {
    try {
      const result = await this.assignSymbolUseCase.execute({
        symbol,
        workerId,
        force: false,
      });

      if (!result.success) {
        throw new Error(result.message || 'Assignment failed');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to assign ${symbol}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Symbol management - Delegate to RemoveSymbolFromWorker use case
   */
  async removeSymbolFromWorker(symbol: string): Promise<void> {
    try {
      const result = await this.removeSymbolUseCase.execute({
        symbol,
        force: false,
      });

      if (!result.success) {
        throw new Error(result.message || 'Removal failed');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to remove ${symbol}: ${errorMessage}`);
      throw error;
    }
  }

  // ============ Worker Pool Management ============

  /**
   * Initialize the worker pool - Delegate to WorkerPoolPort
   */
  async initializeWorkerPool(config: WorkerPoolConfig): Promise<void> {
    await this.workerPoolPort.initialize(config);
  }

  /**
   * Initialize symbol routing to workers
   * Assigns symbols to workers and sends WORKER_INIT messages
   */
  async initializeSymbolRouting(
    symbols: string[],
    socketPath: string
  ): Promise<InitializeSymbolRoutingResult> {
    // Step 1: Assign symbols to workers
    const assignResults = await Promise.allSettled(
      symbols.map((symbol) => this.assignSymbolToWorker(symbol))
    );

    const failedSymbols = assignResults
      .map((result, index) =>
        result.status === 'rejected' ? symbols[index] : null
      )
      .filter((symbol): symbol is string => symbol !== null);

    // Step 2: Pre-compute symbol assignments using ConsistentHashRouter
    const workerIds = this.workerPoolPort.getWorkerIds();
    const workerSymbolMap = new Map<string, string[]>();

    for (const workerId of workerIds) {
      workerSymbolMap.set(workerId, []);
    }

    for (const symbol of symbols) {
      try {
        const routingResult =
          this.consistentHashRouter.getWorkerForSymbol(symbol);
        const workerSymbols = workerSymbolMap.get(routingResult.workerId);
        if (workerSymbols) {
          workerSymbols.push(symbol);
        }
      } catch (error) {
        logger.warn(
          `Failed to route symbol ${symbol}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    // Step 3: Send WORKER_INIT to each worker
    const workerInitResults = new Map<
      string,
      { success: boolean; symbolCount: number }
    >();

    for (const [workerId, assignedSymbols] of workerSymbolMap) {
      try {
        await this.workerCommunicationPort.initializeWorker(workerId, {
          socketPath,
          assignedSymbols,
        });
        workerInitResults.set(workerId, {
          success: true,
          symbolCount: assignedSymbols.length,
        });
        logger.info(
          `Worker ${workerId} initialized with ${
            assignedSymbols.length
          } symbols: [${assignedSymbols.slice(0, 3).join(', ')}${
            assignedSymbols.length > 3 ? '...' : ''
          }]`
        );
      } catch (error) {
        workerInitResults.set(workerId, { success: false, symbolCount: 0 });
        logger.error(
          `Failed to initialize worker ${workerId}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    return {
      success: failedSymbols.length === 0,
      assignedSymbols: symbols.length - failedSymbols.length,
      failedSymbols,
      workerInitResults,
    };
  }

  /**
   * Get all worker IDs - Delegate to WorkerPoolPort
   */
  getWorkerIds(): string[] {
    return this.workerPoolPort.getWorkerIds();
  }

  /**
   * Get worker pool status - Delegate to WorkerPoolPort
   */
  getWorkerPoolStatus(): WorkerPoolStatus {
    return this.workerPoolPort.getStatus();
  }

  /**
   * Shutdown worker pool - Delegate to WorkerPoolPort
   */
  async shutdown(): Promise<void> {
    await this.workerPoolPort.shutdown();
  }
}
