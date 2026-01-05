/**
 * CheckWorkerHealthUseCase - Use case for checking worker health
 *
 * Handles the logic for checking individual worker health via IPC.
 *
 */

import { injectable, inject } from 'inversify';
import { WORKER_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/workerManagement/types.js';
import {
  WorkerManagementPort,
  WorkerMessage,
} from '../../ports/in/WorkerManagementPort.js';
import { WorkerThreadPort } from '../../ports/out/WorkerThreadPort.js';
import {
  CheckWorkerHealthRequest,
  CheckWorkerHealthResult,
  CheckAllWorkersHealthRequest,
  CheckAllWorkersHealthResult,
} from './DTO.js';

const DEFAULT_TIMEOUT_MS = 5000;

@injectable()
export class CheckWorkerHealthUseCase {
  constructor(
    @inject(WORKER_MANAGEMENT_TYPES.WorkerManagementPort)
    private workerManagementPort: WorkerManagementPort,
    @inject(WORKER_MANAGEMENT_TYPES.WorkerThreadPort)
    private workerThreadPort: WorkerThreadPort
  ) {}

  /**
   * Check health of a specific worker
   */
  async execute(
    request: CheckWorkerHealthRequest
  ): Promise<CheckWorkerHealthResult> {
    const { workerId, timeoutMs = DEFAULT_TIMEOUT_MS } = request;

    try {
      const message: WorkerMessage = {
        id: `health_${Date.now()}_${workerId}`,
        type: 'SYNC_METRICS',
        data: { check_timestamp: Date.now() },
      };

      const response = await this.workerManagementPort.sendToWorker(
        workerId,
        message,
        { timeoutMs }
      );

      // Extract metrics from worker response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = response?.result as any;
      const metrics = result
        ? {
            uptimeSeconds: result.uptimeSeconds,
            memoryUsage: result.memoryUsage,
            cpuUsage: result.cpuUsage,
          }
        : undefined;

      // Update WorkerThread.healthMetrics with the received metrics
      if (metrics) {
        const worker = this.workerManagementPort.getWorker(workerId);
        if (worker) {
          // Update memory usage (convert from MB object to bytes)
          if (metrics.memoryUsage?.rssMB) {
            worker.updateMemoryUsage(
              Math.round(metrics.memoryUsage.rssMB * 1024 * 1024)
            );
          } else if (metrics.memoryUsage?.heapUsedMB) {
            worker.updateMemoryUsage(
              Math.round(metrics.memoryUsage.heapUsedMB * 1024 * 1024)
            );
          }
          // Update CPU usage (calculate percentage from delta)
          if (
            metrics.cpuUsage?.userMs !== undefined &&
            metrics.cpuUsage?.systemMs !== undefined
          ) {
            worker.updateCpuUsage({
              userMs: metrics.cpuUsage.userMs,
              systemMs: metrics.cpuUsage.systemMs,
            });
          }
          // Record heartbeat
          worker.recordHeartbeat();
        }
      }

      return {
        workerId,
        isHealthy: true,
        checkedAt: new Date(),
        metrics,
      };
    } catch (error) {
      return {
        workerId,
        isHealthy: false,
        checkedAt: new Date(),
        error: (error as Error).message,
      };
    }
  }

  /**
   * Check health of all workers
   */
  async executeAll(
    request: CheckAllWorkersHealthRequest = {}
  ): Promise<CheckAllWorkersHealthResult> {
    const { timeoutMs = DEFAULT_TIMEOUT_MS } = request;
    const workerIds = this.workerThreadPort.getAllWorkerIds();

    const results = await Promise.all(
      workerIds.map((workerId) => this.execute({ workerId, timeoutMs }))
    );

    const healthyWorkers = results.filter((r) => r.isHealthy).length;
    const totalWorkers = results.length;

    return {
      totalWorkers,
      healthyWorkers,
      unhealthyWorkers: totalWorkers - healthyWorkers,
      healthRatio:
        totalWorkers > 0
          ? Math.round((healthyWorkers / totalWorkers) * 100)
          : 0,
      results,
    };
  }
}
