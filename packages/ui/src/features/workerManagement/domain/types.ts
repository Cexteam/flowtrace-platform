/**
 * Worker Management Domain Types
 *
 * Defines the domain entities and value objects for worker management.
 * These types represent the core business concepts.
 *
 */

/**
 * Worker state enum
 */
export type WorkerState = 'idle' | 'running' | 'stopping' | 'stopped' | 'error';

/**
 * Worker health status for color coding
 */
export type WorkerHealth = 'healthy' | 'warning' | 'error';

/**
 * Worker health metrics
 */
export interface WorkerHealthMetrics {
  totalTradesProcessed: number;
  eventsPublished: number;
  averageProcessingTimeMs: number;
  memoryUsageBytes: number;
  cpuUsagePercent: number;
  errorCount: number;

  // NEW PER-WORKER METRICS (Requirements 1.1, 2.2, 3.2)
  /** Number of pending messages in worker's message queue */
  queueLength: number;
  /** Rolling average processing latency in milliseconds (last 100 batches) */
  processingLatencyMs: number;
  /** Trades processed per second (60-second rolling window) */
  throughputTradesPerSecond: number;
}

/**
 * Worker entity
 */
export interface Worker {
  workerId: string;
  state: WorkerState;
  symbolCount: number;
  uptimeSeconds: number;
  isReady: boolean;
  assignedSymbols: string[];
  lastActivityAt: Date | null;
  healthMetrics: WorkerHealthMetrics | null;
  createdAt: Date;
  // Additional fields for UI display (Requirements 6.1, 7.2)
  cpuUsage?: number; // CPU usage percentage
  memoryUsageMB?: number; // Memory usage in MB
  memoryUsagePercent?: number; // Memory usage percentage
  throughput?: number; // Messages per second
  health?: WorkerHealth; // Health status for color coding
}

/**
 * Worker spawn configuration
 */
export interface WorkerSpawnConfig {
  maxSymbols: number;
  memoryLimitMB: number;
  cpuThreshold: number;
}

/**
 * Default spawn configuration values
 */
export const DEFAULT_SPAWN_CONFIG: WorkerSpawnConfig = {
  maxSymbols: 50,
  memoryLimitMB: 512,
  cpuThreshold: 80,
};

/**
 * Worker spawn result
 */
export interface WorkerSpawnResult {
  workerId: string;
  success: boolean;
  message?: string;
}

/**
 * Worker filters for list queries
 */
export interface WorkerFilters {
  search?: string;
  status?: 'all' | 'running' | 'idle' | 'error';
}

/**
 * Paginated workers request
 */
export interface PaginatedWorkersRequest {
  page: number;
  pageSize: number;
  search?: string;
  status?: 'all' | 'running' | 'idle' | 'error';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated workers response
 */
export interface PaginatedWorkersResponse {
  workers: Worker[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

/**
 * Derive worker health status from metrics
 * Uses queue length, processing latency, and throughput thresholds (Requirements 5.1-5.5)
 */
export function deriveWorkerHealth(worker: Worker): WorkerHealth {
  if (worker.state === 'error') return 'error';
  if (!worker.healthMetrics) return 'healthy';

  const {
    errorCount,
    memoryUsageBytes,
    queueLength,
    processingLatencyMs,
    throughputTradesPerSecond,
  } = worker.healthMetrics;
  const memoryUsageMB = memoryUsageBytes / (1024 * 1024);

  // Critical/Error conditions (Requirements 5.3)
  // - Queue length > 50 OR latency > 5000ms OR error count > 10 OR memory > 1GB
  if (
    (queueLength ?? 0) > 50 ||
    (processingLatencyMs ?? 0) > 5000 ||
    errorCount > 10 ||
    memoryUsageMB > 1024
  ) {
    return 'error';
  }

  // Warning conditions (Requirements 5.2, 5.4)
  // - Queue length > 10 OR latency > 1000ms OR throughput < 1 OR error count > 0 OR memory > 512MB
  if (
    (queueLength ?? 0) > 10 ||
    (processingLatencyMs ?? 0) > 1000 ||
    (throughputTradesPerSecond ?? Infinity) < 1 ||
    errorCount > 0 ||
    memoryUsageMB > 512
  ) {
    return 'warning';
  }

  return 'healthy';
}
