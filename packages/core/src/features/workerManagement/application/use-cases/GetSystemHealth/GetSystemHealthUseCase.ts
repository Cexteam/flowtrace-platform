/**
 * GetSystemHealthUseCase - Use case for retrieving system health information
 *
 * Handles the logic for aggregating and returning worker health statistics.
 * This use case is stateless and receives data via method parameters.
 *
 */

import { injectable } from 'inversify';
import { WorkerHealthStatus } from '../../ports/in/WorkerHealthMonitorPort.js';
import {
  GetSystemHealthResult,
  GetAllWorkersHealthStatusResult,
  GetUnhealthyWorkersResult,
} from './DTO.js';

@injectable()
export class GetSystemHealthUseCase {
  /**
   * Get system-wide health overview
   *
   * @param healthStatuses - Map of worker ID to health status
   */
  execute(
    healthStatuses: Map<string, WorkerHealthStatus>
  ): GetSystemHealthResult {
    const allStatus = Array.from(healthStatuses.values());
    const totalWorkers = allStatus.length;
    const healthyWorkers = allStatus.filter((status) => status.isAlive).length;
    const unhealthyWorkers = totalWorkers - healthyWorkers;
    const averageProcessingTime =
      totalWorkers > 0
        ? allStatus.reduce(
            (sum, status) => sum + status.averageProcessingTime,
            0
          ) / totalWorkers
        : 0;
    const totalErrors = allStatus.reduce(
      (sum, status) => sum + status.errorCount,
      0
    );

    return {
      totalWorkers,
      healthyWorkers,
      unhealthyWorkers,
      averageProcessingTime: Math.round(averageProcessingTime),
      totalErrors,
      healthRatio:
        totalWorkers > 0
          ? Math.round((healthyWorkers / totalWorkers) * 100)
          : 0,
      retrievedAt: new Date(),
    };
  }

  /**
   * Get all workers' health status
   *
   * @param healthStatuses - Map of worker ID to health status
   */
  getAllWorkersHealthStatus(
    healthStatuses: Map<string, WorkerHealthStatus>
  ): GetAllWorkersHealthStatusResult {
    return {
      workers: new Map(healthStatuses),
      retrievedAt: new Date(),
    };
  }

  /**
   * Get unhealthy workers
   *
   * @param healthStatuses - Map of worker ID to health status
   */
  getUnhealthyWorkers(
    healthStatuses: Map<string, WorkerHealthStatus>
  ): GetUnhealthyWorkersResult {
    const unhealthyWorkerIds = Array.from(healthStatuses.entries())
      .filter(([, status]) => !status.isAlive)
      .map(([workerId]) => workerId);

    return {
      unhealthyWorkerIds,
      count: unhealthyWorkerIds.length,
      retrievedAt: new Date(),
    };
  }
}
