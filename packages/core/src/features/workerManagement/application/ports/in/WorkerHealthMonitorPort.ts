/**
 * WorkerHealthMonitorPort - Inbound port for worker health monitoring
 *
 * Defines the contract for monitoring worker thread health and performance.
 * This port is only available in the main thread.
 *
 */

/**
 * Health status for a single worker
 */
export interface WorkerHealthStatus {
  workerId: string;
  isAlive: boolean;
  lastHeartbeat: Date;
  totalRoutesHandled: number;
  routesPerSecond: number;
  averageProcessingTime: number;
  memoryUsage: number;
  errorCount: number;
  lastError?: Error;
}

/**
 * System-wide health overview
 */
export interface SystemHealthOverview {
  totalWorkers: number;
  healthyWorkers: number;
  unhealthyWorkers: number;
  averageProcessingTime: number;
  totalErrors: number;
  healthRatio: number;
}

/**
 * WorkerHealthMonitorPort - Inbound port interface for worker health monitoring
 *
 * Provides methods to monitor, track, and report on worker health.
 */
export interface WorkerHealthMonitorPort {
  /**
   * Start health monitoring for all workers
   */
  startMonitoring(): void;

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void;

  /**
   * Initialize health tracking for a new worker
   *
   * @param workerId - The worker's unique identifier
   */
  initializeWorkerHealth(workerId: string): void;

  /**
   * Remove health tracking for a worker
   *
   * @param workerId - The worker's unique identifier
   */
  removeWorkerHealth(workerId: string): void;

  /**
   * Record successful route handling (performance metrics)
   *
   * @param workerId - The worker's unique identifier
   * @param processingTimeMs - Processing time in milliseconds
   */
  recordRouteHandled(workerId: string, processingTimeMs: number): void;

  /**
   * Record worker error
   *
   * @param workerId - The worker's unique identifier
   * @param error - The error that occurred
   */
  recordError(workerId: string, error: Error): void;

  /**
   * Get health status for all workers
   *
   * @returns Map of worker ID to health status
   */
  getHealthStatus(): Map<string, WorkerHealthStatus>;

  /**
   * Check health of a specific worker
   *
   * @param workerId - The worker's unique identifier
   * @returns Promise resolving to true if worker is healthy
   */
  checkWorkerHealth(workerId: string): Promise<boolean>;

  /**
   * Get unhealthy workers that need restart
   *
   * @returns Array of unhealthy worker IDs
   */
  getUnhealthyWorkers(): string[];

  /**
   * Get system health overview
   *
   * @returns System-wide health statistics
   */
  getSystemHealth(): SystemHealthOverview;
}
