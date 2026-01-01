/**
 * DTOs for CheckWorkerHealth use case
 */

/**
 * Request to check a worker's health
 */
export interface CheckWorkerHealthRequest {
  /** The worker's unique identifier */
  workerId: string;
  /** Timeout in milliseconds for health check (default: 5000) */
  timeoutMs?: number;
}

/**
 * Worker metrics from health check
 */
export interface WorkerMetrics {
  uptimeSeconds?: number;
  memoryUsage?: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
    externalMB: number;
  };
  cpuUsage?: {
    userMs: number;
    systemMs: number;
  };
}

/**
 * Result of a worker health check
 */
export interface CheckWorkerHealthResult {
  /** The worker's unique identifier */
  workerId: string;
  /** Whether the worker is healthy */
  isHealthy: boolean;
  /** Timestamp of the health check */
  checkedAt: Date;
  /** Error message if health check failed */
  error?: string;
  /** Worker metrics (CPU, RAM, uptime) */
  metrics?: WorkerMetrics;
}

/**
 * Request to check all workers' health
 */
export interface CheckAllWorkersHealthRequest {
  /** Timeout in milliseconds for each health check (default: 5000) */
  timeoutMs?: number;
}

/**
 * Result of checking all workers' health
 */
export interface CheckAllWorkersHealthResult {
  /** Total number of workers checked */
  totalWorkers: number;
  /** Number of healthy workers */
  healthyWorkers: number;
  /** Number of unhealthy workers */
  unhealthyWorkers: number;
  /** Health ratio as percentage (0-100) */
  healthRatio: number;
  /** Individual worker results */
  results: CheckWorkerHealthResult[];
}
