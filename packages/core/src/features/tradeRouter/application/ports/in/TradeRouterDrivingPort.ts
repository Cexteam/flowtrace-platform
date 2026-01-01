/**
 * PORT IN - Driving Interface
 * Defines how external actors interact with and drive the Trade Router feature
 **/

export interface TradeRouterDrivingPort {
  /**
   * Core responsibility: Route trades from WebSocket streams to appropriate workers
   */
  routeTrades(
    symbol: string,
    trades: any[],
    options?: {
      priority?: 'urgent' | 'normal';
      batchId?: string;
    }
  ): Promise<any>;

  /**
   * Management: Assign symbols to workers for ownership/routing
   */
  assignSymbolToWorker(symbol: string, workerId?: string): Promise<void>;

  /**
   * Management: Remove symbol assignment from worker
   */
  removeSymbolFromWorker(symbol: string): Promise<void>;

  /**
   * Advanced Status: Get comprehensive enterprise routing status and monitoring
   * IMPLEMENTATION NOTE: Uses GetRoutingStatusUseCase for full analytics
   */
  getDetailedRoutingStatus(request?: {
    includePerformanceMetrics?: boolean;
    includeWorkerDetails?: boolean;
  }): Promise<{
    success: boolean;
    timestamp: Date;
    systemStatus: {
      overallHealth: 'healthy' | 'degraded' | 'critical' | 'error';
      totalWorkers: number;
      activeWorkers: number;
      idleWorkers: number;
      busyWorkers: number;
      errorWorkers: number;
      totalSymbolsAssigned: number;
      averageSymbolsPerWorker: number;
      systemLoadFactor: number;
      uptimeSeconds: number;
    };
    workerStatuses: Array<{
      workerId: string;
      status: 'ready' | 'busy' | 'error' | 'initializing';
      symbolCount: number;
      assignedSymbols: string[];
      lastActivityAt: Date;
      cpuUsage: number;
      memoryUsage: number;
      messageQueueSize: number;
      successRate: number;
      totalTradesProcessed: number;
    }>;
    symbolAssignments: {
      totalUniqueSymbols: number;
      symbolDistribution: Record<string, number>;
      orphanedSymbols: string[];
      contestedSymbols: string[];
      loadBalancedScore: number;
    };
    routingMetrics?: {
      averageRequestLatencyMs: number;
      requestsPerSecond: number;
      successfulRequestsRate: number;
      totalRequestsProcessed: number;
      totalErrors: number;
      routingErrors: number;
      workerErrors: number;
      rebalancingOperations: number;
    };
    message: string;
  }>;

  /**
   * Management: Shutdown routing system gracefully
   */
  shutdown(): Promise<void>;
}
