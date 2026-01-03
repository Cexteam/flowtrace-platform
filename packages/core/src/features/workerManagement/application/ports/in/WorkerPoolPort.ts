/**
 * WorkerPoolPort - Inbound port for worker pool management
 *
 * Defines the contract for managing the worker thread pool lifecycle.
 * This port is only available in the main thread.
 *
 */

import { WorkerThread } from '../../../domain/entities/WorkerThread.js';

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
  /**
   * Number of workers that have sent WORKER_READY
   */
  readyWorkers: number;
  /**
   * List of worker IDs that are not yet ready (pending)
   */
  pendingWorkers: string[];
}

/**
 * Configuration for initializing the worker pool
 */
export interface WorkerPoolConfig {
  /** Number of workers to spawn */
  workerCount: number;
  /**
   * Path to worker entry point script (optional)
   * If not provided, NodeWorkerThreadAdapter will use the default path
   * from @flowtrace/core/dist/worker.js
   */
  workerScript?: string;
  /**
   * IPC socket path for persistence service communication
   * Workers use this to connect to the persistence service
   */
  socketPath?: string;
  /**
   * Timeout in milliseconds to wait for all workers to send WORKER_READY
   * @default 10000 (10 seconds)
   */
  readyTimeout?: number;
}

/**
 * WorkerPoolPort - Inbound port interface for worker pool management
 *
 * Provides methods to initialize, manage, and monitor the worker thread pool.
 */
export interface WorkerPoolPort {
  /**
   * Initialize the worker pool with the specified configuration
   *
   * @param config - Worker pool configuration
   * @returns Promise that resolves when all workers are initialized
   */
  initialize(config: WorkerPoolConfig): Promise<void>;

  /**
   * Gracefully shutdown all workers in the pool
   *
   * @returns Promise that resolves when all workers are terminated
   */
  shutdown(): Promise<void>;

  /**
   * Get the current status of the worker pool
   *
   * @returns Current pool status including worker health information
   */
  getStatus(): WorkerPoolStatus;

  /**
   * Get a specific worker by ID
   *
   * @param workerId - The worker's unique identifier
   * @returns The worker thread or undefined if not found
   */
  getWorker(workerId: string): WorkerThread | undefined;

  /**
   * Get all worker IDs in the pool
   *
   * @returns Array of worker IDs
   */
  getWorkerIds(): string[];

  /**
   * Check if a worker exists in the pool
   *
   * @param workerId - The worker's unique identifier
   * @returns true if worker exists, false otherwise
   */
  hasWorker(workerId: string): boolean;

  /**
   * Check if all workers are ready
   */
  areAllWorkersReady(): boolean;
}
