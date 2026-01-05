/**
 * WorkerStatusPort - Inbound port for worker status and health monitoring
 *
 * Consolidates status methods from WorkerPoolPort and health monitoring
 * from WorkerHealthMonitorPort into a single interface.
 *
 * This port is only available in the main thread.
 */

import { WorkerThread } from '../../../domain/entities/WorkerThread.js';

// ============================================================================
// Status Types
// ============================================================================

/**
 * Worker pool status information
 */
export interface WorkerPoolStatus {
  /** Total number of workers in the pool */
  totalWorkers: number;
  /** Number of healthy/active workers */
  healthyWorkers: number;
  /** Number of unhealthy workers */
  unhealthyWorkers: number;
  /** Worker details */
  workers: WorkerThread[];
  /** Pool uptime in seconds */
  uptimeSeconds: number;
  /** Total events published across all workers */
  totalEventsPublished: number;
  /** Number of workers that have sent WORKER_READY */
  readyWorkers: number;
  /** List of worker IDs that are not yet ready (pending) */
  pendingWorkers: string[];
}

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

// ============================================================================
// Port Interface
// ============================================================================

/**
 * WorkerStatusPort - Inbound port interface for worker status and health
 *
 * Provides methods for:
 * - Pool status queries (getPoolStatus, getWorkerIds, areAllWorkersReady)
 * - Health monitoring (startMonitoring, stopMonitoring, getHealthStatus)
 */
export interface WorkerStatusPort {
  // ============ Pool Status ============

  /**
   * Get the current status of the worker pool
   *
   * @returns Current pool status including worker health information
   */
  getPoolStatus(): WorkerPoolStatus;

  /**
   * Get all worker IDs in the pool
   *
   * @returns Array of worker IDs
   */
  getWorkerIds(): string[];

  /**
   * Check if all workers are ready
   *
   * @returns true if all workers have sent WORKER_READY, false otherwise
   */
  areAllWorkersReady(): boolean;

  // ============ Health Monitoring ============

  /**
   * Start health monitoring for all workers
   */
  startMonitoring(): void;

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void;

  /**
   * Get health status for all workers
   *
   * @returns Map of worker ID to health status
   */
  getHealthStatus(): Map<string, WorkerHealthStatus>;

  /**
   * Record worker error
   *
   * @param workerId - The worker's unique identifier
   * @param error - The error that occurred
   */
  recordError(workerId: string, error: Error): void;

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
}
