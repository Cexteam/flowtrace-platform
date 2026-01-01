/**
 * Use Case: Get Routing Status
 * Business logic for comprehensive system monitoring and health reporting
 * Aggregates worker status, symbol assignments, and performance metrics
 */

import { inject, injectable } from 'inversify';
import { TRADE_ROUTER_TYPES } from '../../../../../shared/lib/di/bindings/features/tradeRouter/types.js';
import { WorkerRepository } from '../../../domain/repositories/WorkerRepository.js';
import { WorkerInfrastructureDrivenPort } from '../../../application/ports/out/WorkerInfrastructureDrivenPort.js';
import {
  GetRoutingStatusRequest,
  GetRoutingStatusResult,
  SystemStatusOverview,
  WorkerStatusSummary,
  SymbolAssignmentOverview,
  RoutingPerformanceMetrics,
} from './DTO.js';

@injectable()
export class GetRoutingStatusUseCase {
  constructor(
    @inject(TRADE_ROUTER_TYPES.WorkerRepository)
    private readonly workerRepository: WorkerRepository,
    @inject(TRADE_ROUTER_TYPES.WorkerInfrastructureDrivenPort)
    private readonly workerInfrastructure: WorkerInfrastructureDrivenPort
  ) {}

  /**
   * Execute comprehensive routing status monitoring
   */
  async execute(
    request: GetRoutingStatusRequest
  ): Promise<GetRoutingStatusResult> {
    try {
      const timestamp = new Date();

      // 1. Gather all workers status
      const allWorkers = await this.workerRepository.getSystemLoad();
      const activeWorkers = await this.workerRepository.findActiveWorkers();

      // 2. Get detailed worker statuses from infrastructure
      const workerStatuses = await this.gatherWorkerStatuses(allWorkers);

      // 3. Analyze symbol assignments
      const symbolAssignments = await this.analyzeSymbolAssignments();

      // 4. Calculate system overview
      const systemStatus = this.calculateSystemOverview(
        workerStatuses,
        symbolAssignments
      );

      // 5. Gather performance metrics
      const routingMetrics = await this.gatherRoutingMetrics(workerStatuses);

      return {
        success: true,
        timestamp,
        systemStatus,
        workerStatuses,
        symbolAssignments,
        routingMetrics,
        message: `Routing status retrieved successfully at ${timestamp.toISOString()}`,
      };
    } catch (error) {
      console.error('GetRoutingStatusUseCase error:', error);

      return {
        success: false,
        timestamp: new Date(),
        systemStatus: this.createErrorSystemStatus(),
        workerStatuses: [],
        symbolAssignments: this.createErrorSymbolAssignments(),
        routingMetrics: this.createErrorMetrics(),
        message: `Failed to retrieve routing status: ${
          (error as Error).message
        }`,
      };
    }
  }

  /**
   * Gather detailed status from each worker
   * PRIVATE: Infrastructure coordination logic
   */
  private async gatherWorkerStatuses(
    allWorkers: any[]
  ): Promise<WorkerStatusSummary[]> {
    const workerStatuses: WorkerStatusSummary[] = [];

    for (const worker of allWorkers) {
      try {
        // WorkerStats has workerId property, not id
        const workerId = worker.workerId || worker.id;

        // Get worker health from infrastructure layer
        const health = await this.workerInfrastructure.getWorkerHealth(
          workerId
        );

        // Get worker state if available
        const workerState = await this.workerInfrastructure.loadWorkerState(
          workerId
        );

        workerStatuses.push({
          workerId: workerId,
          status: this.mapWorkerStatus(health.isHealthy),
          symbolCount: workerState?.symbolsOwned?.length || 0,
          assignedSymbols: workerState?.symbolsOwned || [],
          lastActivityAt: health.lastActivity,
          cpuUsage: workerState?.healthMetrics?.cpuUsage || 0,
          memoryUsage: workerState?.healthMetrics?.memoryUsage || 0,
          messageQueueSize: health.messageQueueSize,
          successRate: workerState?.healthMetrics
            ? workerState.healthMetrics.symbolsProcessedThisMinute || 100
            : 100,
          totalTradesProcessed:
            workerState?.healthMetrics?.symbolsProcessedThisMinute || 0,
        });
      } catch (workerError) {
        const workerId = worker.workerId || worker.id;
        console.warn(
          `Failed to get status for worker ${workerId}:`,
          workerError
        );
        workerStatuses.push(this.createErrorWorkerStatus(workerId));
      }
    }

    return workerStatuses;
  }

  /**
   * Analyze symbol assignment distribution and balance
   * PRIVATE: Business analysis logic
   */
  private async analyzeSymbolAssignments(): Promise<SymbolAssignmentOverview> {
    try {
      const symbolDistribution: Record<string, number> = {};
      const allAssignedSymbols = new Set<string>();
      const workerSymbols: number[] = [];

      // Get all workers from repository
      const allWorkers = await this.workerRepository.findAll();
      const workerIds = allWorkers.map((w) => w.id);

      for (const workerId of workerIds) {
        try {
          const workerState = await this.workerInfrastructure.loadWorkerState(
            workerId
          );
          const symbols = workerState?.symbolsOwned || [];

          workerSymbols.push(symbols.length);

          symbols.forEach((symbol: string) => {
            symbolDistribution[symbol] = (symbolDistribution[symbol] || 0) + 1;
            allAssignedSymbols.add(symbol);
          });
        } catch (error) {
          console.warn(`Cannot get symbols for worker ${workerId}:`, error);
          workerSymbols.push(0);
        }
      }

      // Analyze for issues
      const orphanedSymbols: string[] = [];
      const contestedSymbols: string[] = [];

      for (const [symbol, count] of Object.entries(symbolDistribution)) {
        if (count === 0) {
          orphanedSymbols.push(symbol);
        } else if (count > 1) {
          contestedSymbols.push(symbol);
        }
      }

      return {
        totalUniqueSymbols: allAssignedSymbols.size,
        symbolDistribution,
        orphanedSymbols,
        contestedSymbols,
        loadBalancedScore: this.calculateLoadBalanceScore(workerSymbols),
      };
    } catch (error) {
      console.error('Symbol assignment analysis error:', error);
      return this.createErrorSymbolAssignments();
    }
  }

  /**
   * Calculate system overview from worker statuses
   * PRIVATE: Business calculation logic
   */
  private calculateSystemOverview(
    workerStatuses: WorkerStatusSummary[],
    symbolAssignments: SymbolAssignmentOverview
  ): SystemStatusOverview {
    const totalWorkers = workerStatuses.length;
    const activeWorkers = workerStatuses.filter(
      (w) => w.status === 'ready' || w.status === 'busy'
    ).length;
    const errorWorkers = workerStatuses.filter(
      (w) => w.status === 'error'
    ).length;
    const busyWorkers = workerStatuses.filter(
      (w) => w.status === 'busy'
    ).length;
    const idleWorkers = workerStatuses.filter(
      (w) => w.status === 'ready'
    ).length;

    const totalSymbolsAssigned = symbolAssignments.totalUniqueSymbols;
    const averageSymbolsPerWorker =
      totalWorkers > 0 ? totalSymbolsAssigned / totalWorkers : 0;

    // System load factor (0-1 scale)
    const systemLoadFactor = busyWorkers / Math.max(totalWorkers, 1);

    // Overall health assessment
    const overallHealth = this.calculateOverallHealth(
      errorWorkers,
      busyWorkers,
      totalWorkers
    );

    // Mock uptime - in production, track system startup time
    const uptimeSeconds = Math.floor(process.uptime());

    return {
      overallHealth,
      totalWorkers,
      activeWorkers,
      idleWorkers,
      busyWorkers,
      errorWorkers,
      totalSymbolsAssigned,
      averageSymbolsPerWorker,
      systemLoadFactor,
      uptimeSeconds,
    };
  }

  /**
   * Gather performance metrics across the system
   * PRIVATE: Metrics aggregation logic
   */
  private async gatherRoutingMetrics(
    workerStatuses: WorkerStatusSummary[]
  ): Promise<RoutingPerformanceMetrics> {
    try {
      // Aggregate metrics from workers
      const totalTradesProcessed = workerStatuses.reduce(
        (sum, w) => sum + w.totalTradesProcessed,
        0
      );

      // Calculate averages
      const avgSuccessRate =
        workerStatuses.length > 0
          ? workerStatuses.reduce((sum, w) => sum + w.successRate, 0) /
            workerStatuses.length
          : 0;

      const avgQueueSize =
        workerStatuses.length > 0
          ? workerStatuses.reduce((sum, w) => sum + w.messageQueueSize, 0) /
            workerStatuses.length
          : 0;

      // Mock performance metrics - in production, integrate with metrics collection
      return {
        averageRequestLatencyMs: 2.5, // Target: <5ms
        requestsPerSecond: 1000, // Target: >500 RPS
        successfulRequestsRate: avgSuccessRate,
        averageWorkerResponseTimeMs: 1.0,
        totalRequestsProcessed: totalTradesProcessed,
        peakConcurrentRequests: 100,

        totalErrors: workerStatuses.reduce(
          (sum, w) => sum + (w.status === 'error' ? 1 : 0),
          0
        ),
        routingErrors: 0, // Would need to track routing failures specifically
        workerErrors: workerStatuses.filter((w) => w.status === 'error').length,
        timeoutErrors: 0, // Would need timeout tracking

        rebalancingOperations: 0, // Would track load balancing operations
        symbolReassignments: 0, // Would track rebalancing actions
        averageRebalancingTimeMs: 0, // Would measure effectiveness of rebalancing
      };
    } catch (error) {
      console.error('Metrics gathering error:', error);
      return this.createErrorMetrics();
    }
  }

  /**
   * Map infrastructure worker status to business status
   * PRIVATE: Status mapping business rules
   */
  private mapWorkerStatus(
    infraStatus: any
  ): 'ready' | 'busy' | 'error' | 'initializing' {
    switch (infraStatus) {
      case 'ready':
      case 'idle':
        return 'ready';
      case 'busy':
      case 'processing':
        return 'busy';
      case 'error':
      case 'failed':
        return 'error';
      default:
        return 'initializing';
    }
  }

  /**
   * Calculate overall system health
   * PRIVATE: Health assessment business logic
   */
  private calculateOverallHealth(
    errorCount: number,
    busyCount: number,
    totalCount: number
  ): 'healthy' | 'degraded' | 'critical' | 'error' {
    if (errorCount >= totalCount) return 'error';
    if (errorCount > totalCount * 0.5) return 'critical';
    if (busyCount >= totalCount * 0.8) return 'degraded'; // High load
    return 'healthy';
  }

  /**
   * Calculate load balance score (0-100)
   * PRIVATE: Load balancing analysis logic
   */
  private calculateLoadBalanceScore(symbolCounts: number[]): number {
    if (symbolCounts.length === 0) return 100;

    const average =
      symbolCounts.reduce((sum, count) => sum + count, 0) / symbolCounts.length;

    // Calculate standard deviation from average
    const variance =
      symbolCounts.reduce(
        (sum, count) => sum + Math.pow(count - average, 2),
        0
      ) / symbolCounts.length;
    const stdDev = Math.sqrt(variance);

    // Higher variance = less load balanced (lower score)
    const loadBalanceScore = Math.max(
      0,
      100 - (stdDev / Math.max(average, 1)) * 50
    );

    return Math.round(loadBalanceScore);
  }

  /**
   * Error fallback helpers
   * PRIVATE: Error handling templates
   */
  private createErrorSystemStatus(): SystemStatusOverview {
    return {
      overallHealth: 'error',
      totalWorkers: 0,
      activeWorkers: 0,
      idleWorkers: 0,
      busyWorkers: 0,
      errorWorkers: 0,
      totalSymbolsAssigned: 0,
      averageSymbolsPerWorker: 0,
      systemLoadFactor: 0,
      uptimeSeconds: 0,
    };
  }

  private createErrorWorkerStatus(workerId: string): WorkerStatusSummary {
    return {
      workerId,
      status: 'error',
      symbolCount: 0,
      assignedSymbols: [],
      lastActivityAt: new Date(),
      cpuUsage: 0,
      memoryUsage: 0,
      messageQueueSize: 0,
      successRate: 0,
      totalTradesProcessed: 0,
    };
  }

  private createErrorSymbolAssignments(): SymbolAssignmentOverview {
    return {
      totalUniqueSymbols: 0,
      symbolDistribution: {},
      orphanedSymbols: [],
      contestedSymbols: [],
      loadBalancedScore: 0,
    };
  }

  private createErrorMetrics(): RoutingPerformanceMetrics {
    return {
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
    };
  }
}
