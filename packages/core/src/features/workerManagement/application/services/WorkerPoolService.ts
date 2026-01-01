/**
 * WorkerPoolService - Application service for worker pool management
 *
 * Implements the WorkerPoolPort interface and orchestrates worker lifecycle
 * operations through use cases.
 *
 */

import { injectable, inject } from 'inversify';
import { WORKER_MANAGEMENT_TYPES } from '../../../../shared/lib/di/bindings/features/workerManagement/types.js';
import {
  WorkerPoolPort,
  WorkerPoolStatus,
  WorkerPoolConfig,
} from '../ports/in/WorkerPoolPort.js';
import { WorkerThreadPort } from '../ports/out/WorkerThreadPort.js';
import { WorkerThread } from '../../domain/entities/WorkerThread.js';
import { ConsistentHashRouter } from '../../domain/services/ConsistentHashRouter.js';
import { SpawnWorkerUseCase } from '../use-cases/SpawnWorker/index.js';
import { createLogger } from '../../../../shared/lib/logger/logger.js';

const logger = createLogger('WorkerPoolService');

/**
 * WorkerPoolService - Manages the worker thread pool lifecycle
 */
@injectable()
export class WorkerPoolService implements WorkerPoolPort {
  /** Map of worker ID to WorkerThread entity */
  private workers: Map<string, WorkerThread> = new Map();

  /** Pool start time for uptime calculation */
  private startTime: Date = new Date();

  /** Pool configuration */
  private config: WorkerPoolConfig | null = null;

  /** Set of worker IDs that are pending (spawned but not yet ready) */
  private pendingWorkers: Set<string> = new Set();

  /** Set of worker IDs that have sent WORKER_READY */
  private readyWorkers: Set<string> = new Set();

  /** Default timeout for waiting for workers to be ready (10 seconds) */
  private static readonly DEFAULT_READY_TIMEOUT = 10000;

  /** Resolver function for the waitForAllWorkersReady promise */
  private readyResolver: (() => void) | null = null;

  /** Rejecter function for the waitForAllWorkersReady promise */
  private readyRejecter: ((error: Error) => void) | null = null;

  /** Initialization start time for logging total init time */
  private initStartTime: number = 0;

  constructor(
    @inject(WORKER_MANAGEMENT_TYPES.WorkerThreadPort)
    private workerThreadPort: WorkerThreadPort,

    @inject(WORKER_MANAGEMENT_TYPES.SpawnWorkerUseCase)
    private spawnWorkerUseCase: SpawnWorkerUseCase,

    @inject(WORKER_MANAGEMENT_TYPES.ConsistentHashRouter)
    private router: ConsistentHashRouter
  ) {}

  /**
   * Initialize the worker pool with the specified configuration
   */
  async initialize(config: WorkerPoolConfig): Promise<void> {
    logger.info(
      `Initializing worker pool with ${config.workerCount} workers...`
    );

    this.config = config;
    this.startTime = new Date();
    this.initStartTime = Date.now();

    // Clear any previous state
    this.pendingWorkers.clear();
    this.readyWorkers.clear();
    this.readyResolver = null;
    this.readyRejecter = null;

    // Spawn workers
    const spawnPromises: Promise<void>[] = [];

    for (let i = 0; i < config.workerCount; i++) {
      const workerId = `worker_${i}`;

      // Add to pending set before spawning
      this.pendingWorkers.add(workerId);

      const spawnPromise = this.spawnWorkerUseCase
        .execute({
          workerId,
          scriptPath: config.workerScript,
          socketPath: config.socketPath, // Pass socketPath to worker
        })
        .then((result) => {
          if (result.success && result.threadId !== undefined) {
            // Create and track worker entity (not ready yet, waiting for WORKER_READY message)
            const worker = new WorkerThread(workerId, result.threadId);
            this.workers.set(workerId, worker);

            // Add to router
            this.router.addWorker(workerId);

            // Set up event handlers (including WORKER_READY handler)
            this.setupWorkerHandlers(workerId);

            logger.info(`Worker ${workerId} spawned, waiting for WORKER_READY`);
          } else {
            // Remove from pending if spawn failed
            this.pendingWorkers.delete(workerId);
            logger.error(`Failed to spawn worker ${workerId}: ${result.error}`);
          }
        });

      spawnPromises.push(spawnPromise);
    }

    await Promise.all(spawnPromises);

    logger.info(
      `Worker pool spawned ${this.workers.size}/${config.workerCount} workers, waiting for readiness signals`
    );

    // Wait for all workers to send WORKER_READY
    await this.waitForAllWorkersReady(config.readyTimeout);

    const totalInitTime = Date.now() - this.initStartTime;
    logger.info(
      `Worker pool initialization complete: ${this.workers.size} workers ready in ${totalInitTime}ms`
    );
  }

  /**
   * Gracefully shutdown all workers in the pool
   */
  async shutdown(): Promise<void> {
    logger.info(`Shutting down worker pool (${this.workers.size} workers)...`);

    const terminatePromises: Promise<void>[] = [];

    for (const [workerId, worker] of this.workers) {
      worker.markTerminated();

      const terminatePromise = this.workerThreadPort
        .terminate(workerId)
        .then(() => {
          logger.info(`Worker ${workerId} terminated`);
        })
        .catch((error) => {
          logger.error(
            `Error terminating worker ${workerId}: ${error.message}`
          );
        });

      terminatePromises.push(terminatePromise);
    }

    await Promise.all(terminatePromises);

    this.workers.clear();
    logger.info('Worker pool shutdown complete');
  }

  /**
   * Get the current status of the worker pool
   */
  getStatus(): WorkerPoolStatus {
    const workers = Array.from(this.workers.values());
    const healthyWorkers = workers.filter((w) => w.isHealthy).length;
    const unhealthyWorkers = workers.length - healthyWorkers;

    const totalEventsPublished = workers.reduce(
      (sum, w) => sum + w.healthMetrics.eventsPublished,
      0
    );

    return {
      totalWorkers: workers.length,
      healthyWorkers,
      unhealthyWorkers,
      workers,
      uptimeSeconds: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      totalEventsPublished,
      readyWorkers: this.readyWorkers.size,
      pendingWorkers: Array.from(this.pendingWorkers),
    };
  }

  /**
   * Get a specific worker by ID
   */
  getWorker(workerId: string): WorkerThread | undefined {
    return this.workers.get(workerId);
  }

  /**
   * Get all worker IDs in the pool
   */
  getWorkerIds(): string[] {
    return Array.from(this.workers.keys());
  }

  /**
   * Check if a worker exists in the pool
   */
  hasWorker(workerId: string): boolean {
    return this.workers.has(workerId);
  }

  /**
   * Get count of ready workers
   */
  getReadyWorkerCount(): number {
    return this.readyWorkers.size;
  }

  /**
   * Get list of pending worker IDs (not yet ready)
   */
  getPendingWorkers(): string[] {
    return Array.from(this.pendingWorkers);
  }

  /**
   * Check if all workers are ready
   */
  areAllWorkersReady(): boolean {
    return this.pendingWorkers.size === 0 && this.readyWorkers.size > 0;
  }

  /**
   * Wait for all workers to send WORKER_READY message
   * @param timeout - Timeout in milliseconds (default: 10000)
   * @returns Promise that resolves when all workers are ready or rejects on timeout
   */
  waitForAllWorkersReady(timeout?: number): Promise<void> {
    const timeoutMs =
      timeout ??
      this.config?.readyTimeout ??
      WorkerPoolService.DEFAULT_READY_TIMEOUT;

    // If all workers are already ready, resolve immediately
    if (this.areAllWorkersReady()) {
      const initTime = Date.now() - this.initStartTime;
      logger.info(`All workers ready (took ${initTime}ms)`);
      return Promise.resolve();
    }

    // If no workers are pending (and none ready), something is wrong
    if (this.pendingWorkers.size === 0 && this.readyWorkers.size === 0) {
      return Promise.reject(new Error('No workers to wait for'));
    }

    return new Promise<void>((resolve, reject) => {
      // Store resolver/rejecter for use in handleWorkerReadyMessage
      this.readyResolver = () => {
        const initTime = Date.now() - this.initStartTime;
        logger.info(`All workers ready (took ${initTime}ms)`);
        resolve();
      };
      this.readyRejecter = reject;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        const pendingList = Array.from(this.pendingWorkers).join(', ');
        const error = new Error(
          `Timeout waiting for workers to be ready after ${timeoutMs}ms. ` +
            `Pending workers: [${pendingList}] (${this.pendingWorkers.size} of ${this.workers.size} workers not ready)`
        );

        logger.error(error.message);

        // Clear resolver/rejecter
        this.readyResolver = null;
        this.readyRejecter = null;

        reject(error);
      }, timeoutMs);

      // Override resolver to clear timeout
      const originalResolver = this.readyResolver;
      this.readyResolver = () => {
        clearTimeout(timeoutId);
        this.readyResolver = null;
        this.readyRejecter = null;
        originalResolver();
      };
    });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Set up event handlers for a worker
   */
  private setupWorkerHandlers(workerId: string): void {
    // Handle worker messages
    this.workerThreadPort.onMessage(workerId, (message) => {
      this.handleWorkerMessage(workerId, message);
    });

    // Handle worker errors
    this.workerThreadPort.onError(workerId, (error) => {
      this.handleWorkerError(workerId, error);
    });

    // Handle worker exit
    this.workerThreadPort.onExit(workerId, (exitCode) => {
      this.handleWorkerExit(workerId, exitCode);
    });
  }

  /**
   * Handle incoming message from worker
   */
  private handleWorkerMessage(workerId: string, message: unknown): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.recordHeartbeat();
    }

    // Check if this is a WORKER_READY message
    if (this.isWorkerReadyMessage(message)) {
      this.handleWorkerReadyMessage(workerId, message);
    }

    // Other message handling is done by the IPC service
  }

  /**
   * Type guard to check if message is a WORKER_READY message
   */
  private isWorkerReadyMessage(
    message: unknown
  ): message is { type: 'WORKER_READY'; workerId: string; timestamp: number } {
    return (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      (message as { type: string }).type === 'WORKER_READY' &&
      'workerId' in message &&
      'timestamp' in message
    );
  }

  /**
   * Handle WORKER_READY message from worker
   */
  private handleWorkerReadyMessage(
    workerId: string,
    message: { type: 'WORKER_READY'; workerId: string; timestamp: number }
  ): void {
    const worker = this.workers.get(workerId);
    if (!worker) {
      logger.warn(`Received WORKER_READY from unknown worker: ${workerId}`);
      return;
    }

    // Move worker from pending to ready set
    this.pendingWorkers.delete(workerId);
    this.readyWorkers.add(workerId);

    // Mark WorkerThread entity as ready
    worker.markWorkerReady(message.timestamp);

    logger.info(
      `Worker ${workerId} is ready (${this.readyWorkers.size}/${this.workers.size} workers ready)`
    );

    // Check if all workers are now ready and resolve the waiting promise
    if (this.areAllWorkersReady() && this.readyResolver) {
      this.readyResolver();
    }
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(workerId: string, error: Error): void {
    logger.error(`Worker ${workerId} error: ${error.message}`);

    const worker = this.workers.get(workerId);
    if (worker) {
      worker.recordError(error.message);
      worker.markUnhealthy(error.message);
    }
  }

  /**
   * Handle worker exit
   */
  private handleWorkerExit(workerId: string, exitCode: number): void {
    logger.warn(`Worker ${workerId} exited with code ${exitCode}`);

    const worker = this.workers.get(workerId);
    if (worker) {
      worker.markTerminated();
    }

    // Remove from router
    this.router.removeWorker(workerId);

    // Optionally restart the worker
    if (exitCode !== 0 && this.config) {
      logger.info(`Attempting to restart worker ${workerId}...`);
      this.restartWorker(workerId);
    }
  }

  /**
   * Restart a failed worker
   */
  private async restartWorker(workerId: string): Promise<void> {
    if (!this.config) return;

    // Remove old worker from tracking
    this.workers.delete(workerId);
    this.readyWorkers.delete(workerId);
    this.pendingWorkers.delete(workerId);

    // Add to pending before spawning
    this.pendingWorkers.add(workerId);

    // Spawn new worker with socketPath
    const result = await this.spawnWorkerUseCase.execute({
      workerId,
      scriptPath: this.config.workerScript,
      socketPath: this.config.socketPath, // Pass socketPath to restarted worker
    });

    if (result.success && result.threadId !== undefined) {
      const worker = new WorkerThread(workerId, result.threadId);
      this.workers.set(workerId, worker);
      this.router.addWorker(workerId);
      this.setupWorkerHandlers(workerId);

      logger.info(`Worker ${workerId} restarted, waiting for WORKER_READY`);
    } else {
      // Remove from pending if spawn failed
      this.pendingWorkers.delete(workerId);
      logger.error(`Failed to restart worker ${workerId}: ${result.error}`);
    }
  }
}
