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
    // Use proper Port In methods instead of type casting
    const workers = this.workerManagementPort.getAllWorkers();
    const startTime = this.workerManagementPort.getPoolStartTime();
    const readyWorkerIds = this.workerManagementPort.getReadyWorkerIds();
    const pendingWorkerIds = this.workerManagementPort.getPendingWorkerIds();

    const healthyWorkers = workers.filter((w) => w.isHealthy).length;
    const unhealthyWorkers = workers.length - healthyWorkers;

    const totalEventsPublished = workers.reduce(
      (sum: number, w) => sum + (w.healthMetrics?.eventsPublished || 0),
      0
    );

    return {
      totalWorkers: workers.length,
      healthyWorkers,
      unhealthyWorkers,
      workers,
      uptimeSeconds: Math.floor((Date.now() - startTime.getTime()) / 1000),
      totalEventsPublished,
      readyWorkers: readyWorkerIds.length,
      pendingWorkers: pendingWorkerIds,
    };
  }

  getWorkerIds(): string[] {
    return this.workerThreadPort.getAllWorkerIds();
  }

  areAllWorkersReady(): boolean {
    // Use proper Port In methods instead of type casting
    const pendingWorkerIds = this.workerManagementPort.getPendingWorkerIds();
    const readyWorkerIds = this.workerManagementPort.getReadyWorkerIds();

    return pendingWorkerIds.length === 0 && readyWorkerIds.length > 0;
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
      const unhealthyWorkers = result.results.filter((r) => !r.isHealthy);
      logger.warn(`🚨 CRITICAL: Only ${result.healthRatio}% workers healthy!`, {
        healthyWorkers: result.healthyWorkers,
        totalWorkers: result.totalWorkers,
        unhealthyWorkerIds: unhealthyWorkers.map((w) => w.workerId),
        unhealthyDetails: unhealthyWorkers.map((w) => ({
          workerId: w.workerId,
          error: w.error,
          metrics: w.metrics,
        })),
      });
    }
  }
}
