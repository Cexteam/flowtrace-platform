/**
 * WorkerHealthMonitorService - Application service for worker health monitoring
 *
 * Implements WorkerHealthMonitorPort and orchestrates use cases.
 * This service is part of the workerManagement feature.
 *
 */

import { injectable, inject } from 'inversify';
import { WORKER_MANAGEMENT_TYPES } from '../../../../shared/lib/di/bindings/features/workerManagement/types.js';
import {
  WorkerHealthMonitorPort,
  WorkerHealthStatus,
  SystemHealthOverview,
} from '../ports/in/WorkerHealthMonitorPort.js';
import { WorkerThreadPort } from '../ports/out/WorkerThreadPort.js';
import { CheckWorkerHealthUseCase } from '../use-cases/CheckWorkerHealth/index.js';
import { GetSystemHealthUseCase } from '../use-cases/GetSystemHealth/index.js';
import { createLogger } from '../../../../shared/lib/logger/logger.js';

const logger = createLogger('WorkerHealthMonitorService');

/**
 * WorkerHealthMonitorService - Implements WorkerHealthMonitorPort
 *
 * Orchestrates health monitoring use cases and manages health status storage.
 */
@injectable()
export class WorkerHealthMonitorService implements WorkerHealthMonitorPort {
  private healthStatus = new Map<string, WorkerHealthStatus>();
  private healthCheckInterval?: NodeJS.Timeout;
  private readonly HEALTH_CHECK_INTERVAL_MS = 30000; // 30 seconds

  constructor(
    @inject(WORKER_MANAGEMENT_TYPES.CheckWorkerHealthUseCase)
    private checkWorkerHealthUseCase: CheckWorkerHealthUseCase,
    @inject(WORKER_MANAGEMENT_TYPES.GetSystemHealthUseCase)
    private getSystemHealthUseCase: GetSystemHealthUseCase,
    @inject(WORKER_MANAGEMENT_TYPES.WorkerThreadPort)
    private workerThreadPort: WorkerThreadPort
  ) {}

  // ============================================================================
  // WorkerHealthMonitorPort Implementation
  // ============================================================================

  /**
   * Start health monitoring for all workers
   */
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

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    logger.info('🛑 Worker health monitoring stopped');
  }

  /**
   * Initialize health tracking for a new worker
   */
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

  /**
   * Remove health tracking for a worker
   */
  removeWorkerHealth(workerId: string): void {
    this.healthStatus.delete(workerId);
    logger.info(`🗑️ Worker ${workerId} health monitoring removed`);
  }

  /**
   * Record successful route handling (performance metrics)
   */
  recordRouteHandled(workerId: string, processingTimeMs: number): void {
    const status = this.healthStatus.get(workerId);
    if (status) {
      status.totalRoutesHandled++;
      status.lastHeartbeat = new Date();

      // Rolling average for processing time
      status.averageProcessingTime =
        (status.averageProcessingTime + processingTimeMs) / 2;

      // Calculate routes per second
      status.routesPerSecond = 1000 / processingTimeMs;
    }
  }

  /**
   * Record worker error
   */
  recordError(workerId: string, error: Error): void {
    const status = this.healthStatus.get(workerId);
    if (status) {
      status.errorCount++;
      status.lastError = error;
      logger.warn(`⚠️ Worker ${workerId} error recorded: ${error.message}`);
    }
  }

  /**
   * Get health status for all workers (delegates to use case)
   */
  getHealthStatus(): Map<string, WorkerHealthStatus> {
    return this.getSystemHealthUseCase.getAllWorkersHealthStatus(
      this.healthStatus
    ).workers;
  }

  /**
   * Check health of a specific worker (delegates to use case)
   */
  async checkWorkerHealth(workerId: string): Promise<boolean> {
    const result = await this.checkWorkerHealthUseCase.execute({ workerId });

    // Update internal state based on result
    const status = this.healthStatus.get(workerId);
    if (status) {
      status.isAlive = result.isHealthy;
      status.lastHeartbeat = result.checkedAt;
      if (!result.isHealthy && result.error) {
        this.recordError(workerId, new Error(result.error));
      }
    }

    return result.isHealthy;
  }

  /**
   * Get unhealthy workers (delegates to use case)
   */
  getUnhealthyWorkers(): string[] {
    return this.getSystemHealthUseCase.getUnhealthyWorkers(this.healthStatus)
      .unhealthyWorkerIds;
  }

  /**
   * Get system health overview (delegates to use case)
   */
  getSystemHealth(): SystemHealthOverview {
    const result = this.getSystemHealthUseCase.execute(this.healthStatus);
    // Return without retrievedAt to match interface
    return {
      totalWorkers: result.totalWorkers,
      healthyWorkers: result.healthyWorkers,
      unhealthyWorkers: result.unhealthyWorkers,
      averageProcessingTime: result.averageProcessingTime,
      totalErrors: result.totalErrors,
      healthRatio: result.healthRatio,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Check health of all workers (internal periodic check)
   */
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
