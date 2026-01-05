/**
 * WorkersService - Shared service for HTTP and IPC
 *
 * This service provides worker management operations that can be used
 * by both HTTP controllers and IPC handlers.
 *
 */

import { Injectable, Inject } from '@nestjs/common';
import { BRIDGE_TOKENS } from '../../../bridge/index.js';
import type { WorkerManagementPort, WorkerStatusPort } from '@flowtrace/core';
import type {
  WorkerResponseDto,
  WorkerListResponseDto,
  WorkerHealthResponseDto,
  WorkerHealthMetricsDto,
  WorkerStatsDto,
} from '../presentation/dto/index.js';

/**
 * Transform WorkerThread entity to API response DTO
 */
function toWorkerResponseDto(
  worker: Record<string, unknown>
): WorkerResponseDto {
  const healthMetrics = worker.healthMetrics as
    | Record<string, unknown>
    | undefined;

  return {
    workerId: worker.workerId as string,
    threadId: worker.threadId as number,
    state: worker.state as string,
    symbolCount: (worker.assignedSymbols as string[])?.length ?? 0,
    uptimeSeconds: worker.uptimeSeconds as number,
    isReady: worker.isReady as boolean,
    healthMetrics: {
      totalTradesProcessed:
        (healthMetrics?.totalTradesProcessed as number) ?? 0,
      eventsPublished: (healthMetrics?.eventsPublished as number) ?? 0,
      averageProcessingTimeMs:
        (healthMetrics?.averageProcessingTimeMs as number) ?? 0,
      memoryUsageBytes: (healthMetrics?.memoryUsageBytes as number) ?? 0,
      cpuUsagePercent: (healthMetrics?.cpuUsagePercent as number) ?? 0,
      errorCount: (healthMetrics?.errorCount as number) ?? 0,
      lastError: healthMetrics?.lastError as string | undefined,
    },
    assignedSymbols: (worker.assignedSymbols as string[]) ?? [],
    lastActivityAt: worker.lastActivityAt as string,
    createdAt: worker.createdAt as string,
  };
}

@Injectable()
export class WorkersService {
  constructor(
    @Inject(BRIDGE_TOKENS.WORKER_MANAGEMENT_PORT)
    private readonly workerManagementPort: WorkerManagementPort | null,
    @Inject(BRIDGE_TOKENS.WORKER_STATUS_PORT)
    private readonly workerStatusPort: WorkerStatusPort | null
  ) {}

  /**
   * Ensure the worker status port is available
   */
  private getWorkerStatusPort(): WorkerStatusPort {
    if (!this.workerStatusPort) {
      throw new Error('Worker status service not available');
    }
    return this.workerStatusPort;
  }

  /**
   * Ensure the worker management port is available
   */
  private getWorkerManagementPort(): WorkerManagementPort {
    if (!this.workerManagementPort) {
      throw new Error('Worker management service not available');
    }
    return this.workerManagementPort;
  }

  /**
   * Get all workers with their status
   */
  async getWorkers(): Promise<WorkerListResponseDto> {
    const port = this.getWorkerStatusPort();
    const status = port.getPoolStatus();

    // Transform workers to response DTOs
    const workerDtos = status.workers.map((worker) =>
      toWorkerResponseDto(worker.toJSON())
    );

    return {
      workers: workerDtos,
      totalWorkers: status.totalWorkers,
      healthyWorkers: status.healthyWorkers,
      unhealthyWorkers: status.unhealthyWorkers,
      readyWorkers: status.readyWorkers,
      uptimeSeconds: status.uptimeSeconds,
    };
  }

  /**
   * Get a worker by ID
   */
  async getWorkerById(workerId: string): Promise<WorkerResponseDto | null> {
    const port = this.getWorkerManagementPort();
    const worker = port.getWorker(workerId);

    if (!worker) {
      return null;
    }

    return toWorkerResponseDto(worker.toJSON());
  }

  /**
   * Get health metrics for a specific worker
   */
  async getWorkerHealth(
    workerId: string
  ): Promise<WorkerHealthResponseDto | null> {
    const managementPort = this.getWorkerManagementPort();
    const statusPort = this.getWorkerStatusPort();

    // First check if worker exists
    const worker = managementPort.getWorker(workerId);
    if (!worker) {
      return null;
    }

    // Get health status from status port
    const healthStatusMap = statusPort.getHealthStatus();
    const healthStatus = healthStatusMap.get(workerId);

    const workerJson = worker.toJSON();
    const healthMetrics = workerJson.healthMetrics as
      | Record<string, unknown>
      | undefined;

    return {
      workerId,
      isHealthy: worker.isHealthy,
      healthMetrics: {
        totalTradesProcessed:
          (healthMetrics?.totalTradesProcessed as number) ?? 0,
        eventsPublished: (healthMetrics?.eventsPublished as number) ?? 0,
        averageProcessingTimeMs:
          (healthMetrics?.averageProcessingTimeMs as number) ?? 0,
        memoryUsageBytes: (healthMetrics?.memoryUsageBytes as number) ?? 0,
        cpuUsagePercent: (healthMetrics?.cpuUsagePercent as number) ?? 0,
        errorCount: (healthMetrics?.errorCount as number) ?? 0,
        lastError: healthMetrics?.lastError as string | undefined,
      },
      lastHeartbeat:
        healthStatus?.lastHeartbeat?.toISOString() ??
        (healthMetrics?.lastHeartbeat as Date)?.toISOString() ??
        new Date().toISOString(),
    };
  }

  /**
   * Get summary statistics about the worker pool
   *
   */
  async getWorkerStats(): Promise<WorkerStatsDto> {
    const port = this.getWorkerStatusPort();
    const status = port.getPoolStatus();

    const totalSymbols = status.workers.reduce((sum, worker) => {
      const assignedSymbols = worker.toJSON().assignedSymbols as
        | string[]
        | undefined;
      return sum + (assignedSymbols?.length ?? 0);
    }, 0);

    return {
      totalWorkers: status.totalWorkers,
      activeWorkers: status.healthyWorkers,
      totalSymbols,
    };
  }
}
