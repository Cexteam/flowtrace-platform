/**
 * Data Transfer Objects: GetRoutingStatus Use Case
 * Request/Response contracts for routing system status monitoring
 */

export interface GetRoutingStatusRequest {
  /* Optional filters for specific status details */
}

export interface GetRoutingStatusResult {
  success: boolean;
  timestamp: Date;
  systemStatus: SystemStatusOverview;
  workerStatuses: WorkerStatusSummary[];
  symbolAssignments: SymbolAssignmentOverview;
  routingMetrics: RoutingPerformanceMetrics;
  message: string;
}

export interface SystemStatusOverview {
  overallHealth: 'healthy' | 'degraded' | 'critical' | 'error';
  totalWorkers: number;
  activeWorkers: number;
  idleWorkers: number;
  busyWorkers: number;
  errorWorkers: number;
  totalSymbolsAssigned: number;
  averageSymbolsPerWorker: number;
  systemLoadFactor: number; // 0-1 scale
  uptimeSeconds: number;
}

export interface WorkerStatusSummary {
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
}

export interface SymbolAssignmentOverview {
  totalUniqueSymbols: number;
  symbolDistribution: Record<string, number>; // symbol -> worker count (should be 1 each)
  orphanedSymbols: string[]; // symbols without assignment
  contestedSymbols: string[]; // symbols with multiple assignments
  loadBalancedScore: number; // 0-100 score of distribution fairness
}

export interface RoutingPerformanceMetrics {
  averageRequestLatencyMs: number; // end-to-end latency
  requestsPerSecond: number;
  successfulRequestsRate: number; // percentage
  averageWorkerResponseTimeMs: number;
  totalRequestsProcessed: number;
  peakConcurrentRequests: number;

  // Error rates
  totalErrors: number;
  routingErrors: number; // worker not found, etc.
  workerErrors: number; // worker failures
  timeoutErrors: number;

  // Load balancing metrics
  rebalancingOperations: number;
  symbolReassignments: number;
  averageRebalancingTimeMs: number;
}
