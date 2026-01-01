/**
 * Trade Router Service - Application Layer Implementation
 * Implements TradeRouterDrivingPort interface using RAG pattern
 * Thin orchestration layer that delegates business logic to use cases
 */

import { injectable, inject } from 'inversify';
import { TRADE_ROUTER_TYPES } from '../../../../shared/lib/di/bindings/features/tradeRouter/types.js';
import { TradeRouterDrivingPort } from '../ports/in/TradeRouterDrivingPort.js';
import type {
  RouteTradesUseCase,
  RouteTradesRequest,
} from '../use-cases/RouteTrades/index.js';
import type { AssignSymbolToWorkerUseCase } from '../use-cases/AssignSymbolToWorker/index.js';
import type { RemoveSymbolFromWorkerUseCase } from '../use-cases/RemoveSymbolFromWorker/index.js';
import type { GetRoutingStatusUseCase } from '../use-cases/GetRoutingStatus/index.js';

@injectable()
export class TradeRouterService implements TradeRouterDrivingPort {
  constructor(
    @inject(TRADE_ROUTER_TYPES.RouteTradesUseCase)
    private routeTradesUseCase: RouteTradesUseCase,
    @inject(TRADE_ROUTER_TYPES.AssignSymbolToWorkerUseCase)
    private assignSymbolUseCase: AssignSymbolToWorkerUseCase,
    @inject(TRADE_ROUTER_TYPES.RemoveSymbolFromWorkerUseCase)
    private removeSymbolUseCase: RemoveSymbolFromWorkerUseCase,
    @inject(TRADE_ROUTER_TYPES.GetRoutingStatusUseCase)
    private routingStatusUseCase: GetRoutingStatusUseCase
  ) {}

  /**
   * Core routing functionality - RAG Pattern: Delegate to Use Case
   * Thin orchestration layer that delegates complex business logic to RouteTradesUseCase
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
      // Delegate all business logic to use case
      const result = await this.routeTradesUseCase.execute(request);

      if (result.success) {
        // Log success with business metrics
        // console.log(
        //   `Successfully routed ${result.tradeCount} trades for ${result.symbol} to worker ${result.workerId} (${result.processingTime}ms)`
        // );
        return result; // Return full result for compatibility
      } else {
        // Handle business-level errors
        throw new Error(
          `Routing failed for symbol ${result.symbol}: ${result.error}`
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown routing error';
      console.error(`TradeRouterService routeTrades failed:`, errorMessage);
      throw error; // Propagate with original context
    }
  }

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
      console.error(`❌ Failed to assign ${symbol}:`, errorMessage);
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
      console.error(`❌ Failed to remove ${symbol}:`, errorMessage);
      throw error;
    }
  }

  /**
   * Advanced Status: Comprehensive enterprise routing monitoring
   * Delegate to GetRoutingStatusUseCase
   */
  async getDetailedRoutingStatus(_request?: {
    includePerformanceMetrics?: boolean;
    includeWorkerDetails?: boolean;
  }): Promise<any> {
    try {
      const result = await this.routingStatusUseCase.execute({});
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to get routing status:`, errorMessage);

      // Return error response with proper structure
      return {
        success: false,
        timestamp: new Date(),
        systemStatus: {
          overallHealth: 'error' as const,
          totalWorkers: 0,
          activeWorkers: 0,
          idleWorkers: 0,
          busyWorkers: 0,
          errorWorkers: 0,
          totalSymbolsAssigned: 0,
          averageSymbolsPerWorker: 0,
          systemLoadFactor: 0,
          uptimeSeconds: 0,
        },
        workerStatuses: [],
        symbolAssignments: {
          totalUniqueSymbols: 0,
          symbolDistribution: {},
          orphanedSymbols: [],
          contestedSymbols: [],
          loadBalancedScore: 0,
        },
        routingMetrics: {
          averageRequestLatencyMs: 0,
          requestsPerSecond: 0,
          successfulRequestsRate: 0,
          averageWorkerResponseTimeMs: 0,
          totalRequestsProcessed: 0,
          peakConcurrentRequests: 0,
          totalErrors: 0,
          routingErrors: 0,
          workerErrors: 0,
          timeoutErrors: 0,
          rebalancingOperations: 0,
          symbolReassignments: 0,
          averageRebalancingTimeMs: 0,
        },
        message: `Routing status error: ${errorMessage}`,
      };
    }
  }

  /**
   * System management - graceful shutdown
   */
  async shutdown(): Promise<void> {
    // Graceful shutdown coordination delegated to use cases
  }
}
