/**
 * WorkerStatusService - Service for worker status and health monitoring
 *
 * Implements WorkerStatusPort by extending WorkerHealthMonitorService
 * with status methods from WorkerPoolService.
 */

import { injectable, inject } from 'inversify';
import { WORKER_MANAGEMENT_TYPES } from '../../../../shared/lib/di/bindings/features/workerManagement/types.js';
import {
  WorkerStatusPort,
  WorkerPoolStatus,
  WorkerHealthStatus,
} from '../ports/in/WorkerStatusPort.js';
import { WorkerManagementPort } from '../ports/in/WorkerManagementPort.js';
import { WorkerThreadPort } from '../ports/out/WorkerThreadPort.js';
import { WorkerThread } from '../../domain/entities/WorkerThread.js';
import { CheckWorkerHealthUseCase } from '../use-cases/CheckWorkerHealth/index.js';
import { GetSystemHealthUseCase } from '../use-cases/GetSystemHealth/index.js';
import { createLogger } from '../../../../shared/lib/logger/logger.js';

const logger = createLogger('WorkerStatusService');

@injectable()
export class WorkerStatusService implements WorkerStatusPort {
  private healthStatus = new Map<string, WorkerHealthStatus>();
  private healthCheckInterval?: NodeJS.Timeout;
  private readonly HEALTH_CHECK_INTERVAL_MS = 30000; // 30 seconds

  constructor(
    @inject(WORKER_MANAGEMENT_TYPES.CheckWorkerHealthUseCase)
    private checkWorkerHealthUseCase: CheckWorkerHealthUseCase,

    @inject(WORKER_MANAGEMENT_TYPES.GetSystemHealthUseCase)
    private getSystemHealthUseCase: GetSystemHealthUseCase,

    @inject(WORKER_MANAGEMENT_TYPES.WorkerThreadPort)
    private workerThreadPort: WorkerThreadPort,

    @inject(WORKER_MANAGEMENT_TYPES.WorkerManagementPort)
    private workerManagementPort: WorkerManagementPort
  ) {}

  // ============================================================================
  // Pool Status Methods
  // ============================================================================

  getPoolStatus(): WorkerPoolStatus {
    // Access internal state from WorkerManagementService
    const internalState = (
      this.workerManagementPort as any
    ).getInternalState?.();

    if (!internalState) {
      // Fallback if getInternalState is not available
      const workerIds = this.workerThreadPort.getAllWorkerIds();
      return {
        totalWorkers: workerIds.length,
        healthyWorkers: workerIds.length,
        unhealthyWorkers: 0,
        workers: [],
        uptimeSeconds: 0,
        totalEventsPublished: 0,
        readyWorkers: workerIds.length,
        pendingWorkers: [],
      };
    }

    const { workers, startTime, readyWorkers, pendingWorkers } = internalState;
    const workerArray = Array.from(
      (workers as Map<string, WorkerThread>).values()
    );
    const healthyWorkers = workerArray.filter((w) => w.isHealthy).length;
    const unhealthyWorkers = workerArray.length - healthyWorkers;

    const totalEventsPublished = workerArray.reduce(
      (sum: number, w) => sum + (w.healthMetrics?.eventsPublished || 0),
      0
    );

    return {
      totalWorkers: workerArray.length,
      healthyWorkers,
      unhealthyWorkers,
      workers: workerArray,
      uptimeSeconds: Math.floor((Date.now() - startTime.getTime()) / 1000),
      totalEventsPublished,
      readyWorkers: readyWorkers.size,
      pendingWorkers: Array.from(pendingWorkers),
    };
  }

  getWorkerIds(): string[] {
    return this.workerThreadPort.getAllWorkerIds();
  }

  areAllWorkersReady(): boolean {
    const internalState = (
      this.workerManagementPort as any
    ).getInternalState?.();

    if (!internalState) {
      return this.workerThreadPort.getAllWorkerIds().length > 0;
    }

    const { pendingWorkers, readyWorkers } = internalState;
    return pendingWorkers.size === 0 && readyWorkers.size > 0;
  }

  // ============================================================================
  // Health Monitoring Methods
  // ============================================================================

  startMonitoring(): void {
    logger.info('🚀 Starting worker health monitoring');

    // Initial check for all existing workers
    for (const workerId of this.workerThreadPort.getAllWorkerIds()) {
      this.initializeWorkerHealth(workerId);
    }

    // Setup periodic health monitoring
    this.healthCheckInterval = setInterval(() => {
      this.checkAllWorkersHealthInternal();
    }, this.HEALTH_CHECK_INTERVAL_MS);

    logger.info('✅ Worker health monitoring started with periodic checks');
  }

  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    logger.info('🛑 Worker health monitoring stopped');
  }

  getHealthStatus(): Map<string, WorkerHealthStatus> {
    return this.getSystemHealthUseCase.getAllWorkersHealthStatus(
      this.healthStatus
    ).workers;
  }

  recordError(workerId: string, error: Error): void {
    const status = this.healthStatus.get(workerId);
    if (status) {
      status.errorCount++;
      status.lastError = error;
      logger.warn(`⚠️ Worker ${workerId} error recorded: ${error.message}`);
    }
  }

  initializeWorkerHealth(workerId: string): void {
    if (!this.healthStatus.has(workerId)) {
      this.healthStatus.set(workerId, {
        workerId,
        isAlive: true,
        lastHeartbeat: new Date(),
        totalRoutesHandled: 0,
        routesPerSecond: 0,
        averageProcessingTime: 0,
        memoryUsage: 0,
        errorCount: 0,
      });

      logger.info(`🩺 Worker ${workerId} health monitoring initialized`);
    }
  }

  removeWorkerHealth(workerId: string): void {
    this.healthStatus.delete(workerId);
    logger.info(`🗑️ Worker ${workerId} health monitoring removed`);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async checkAllWorkersHealthInternal(): Promise<void> {
    const result = await this.checkWorkerHealthUseCase.executeAll({});

    // Update internal state for each worker
    for (const workerResult of result.results) {
      const status = this.healthStatus.get(workerResult.workerId);
      if (status) {
        status.isAlive = workerResult.isHealthy;
        status.lastHeartbeat = workerResult.checkedAt;
        if (!workerResult.isHealthy && workerResult.error) {
          status.errorCount++;
          status.lastError = new Error(workerResult.error);
        }
      }
    }

    // Log health check summary with metrics
    logger.info(
      `⚕️ Worker health check: ${result.healthyWorkers}/${result.totalWorkers} workers healthy`,
      {
        healthRatio: result.healthRatio,
        workers: result.results.map((r) => ({
          workerId: r.workerId,
          healthy: r.isHealthy,
          metrics: r.metrics,
        })),
      }
    );

    // Warn if we're below 80% healthy workers
    if (result.healthRatio < 80) {
      logger.warn(`🚨 CRITICAL: Only ${result.healthRatio}% workers healthy!`);
    }
  }
}
