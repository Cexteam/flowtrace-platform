/**
 * HttpWorkerAdapter - HTTP implementation of WorkerApiPort
 *
 * Implements WorkerApiPort for Cloud deployment using REST API calls.
 *
 */

import { injectable, inject } from 'inversify';
import { UI_CORE_TYPES } from '../../../../../shared/lib/di/core/types';
import type {
  WorkerApiPort,
  GetWorkersRequest,
  GetWorkersResponse,
} from '../../../application/ports/out/WorkerApiPort';
import type {
  Worker,
  WorkerHealthMetrics,
  WorkerSpawnConfig,
  WorkerSpawnResult,
} from '../../../domain/types';

/**
 * HTTP adapter for worker API operations
 *
 * Makes REST API calls to the backend server for worker management.
 */
@injectable()
export class HttpWorkerAdapter implements WorkerApiPort {
  private readonly baseUrl: string;

  constructor(@inject(UI_CORE_TYPES.ApiBaseUrl) apiBaseUrl: string) {
    this.baseUrl = apiBaseUrl;
  }

  /**
   * Get all workers with optional filtering
   */
  async getWorkers(request?: GetWorkersRequest): Promise<GetWorkersResponse> {
    const params = new URLSearchParams();
    if (request?.state) params.append('state', request.state);
    if (request?.limit) params.append('limit', request.limit.toString());
    if (request?.offset) params.append('offset', request.offset.toString());

    const queryString = params.toString();
    const url = `${this.baseUrl}/workers${
      queryString ? `?${queryString}` : ''
    }`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch workers: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      workers: data.workers.map(this.mapWorkerFromApi),
      total: data.total,
    };
  }

  /**
   * Get a specific worker by ID
   */
  async getWorkerById(workerId: string): Promise<Worker | null> {
    const response = await fetch(`${this.baseUrl}/workers/${workerId}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch worker: ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapWorkerFromApi(data);
  }

  /**
   * Spawn a new worker with the given configuration
   */
  async spawnWorker(config: WorkerSpawnConfig): Promise<WorkerSpawnResult> {
    const response = await fetch(`${this.baseUrl}/workers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return {
        workerId: '',
        success: false,
        message:
          error.message || `Failed to spawn worker: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      workerId: data.workerId,
      success: true,
      message: data.message,
    };
  }

  /**
   * Get health metrics for a specific worker
   */
  async getWorkerHealth(workerId: string): Promise<WorkerHealthMetrics | null> {
    const response = await fetch(`${this.baseUrl}/workers/${workerId}/health`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch worker health: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Map API response to Worker domain type
   */
  private mapWorkerFromApi(data: Record<string, unknown>): Worker {
    return {
      workerId: data.workerId as string,
      state: data.state as Worker['state'],
      symbolCount: data.symbolCount as number,
      uptimeSeconds: data.uptimeSeconds as number,
      isReady: data.isReady as boolean,
      assignedSymbols: (data.assignedSymbols as string[]) || [],
      lastActivityAt: data.lastActivityAt
        ? new Date(data.lastActivityAt as string)
        : null,
      healthMetrics: data.healthMetrics as WorkerHealthMetrics | null,
      createdAt: new Date(data.createdAt as string),
    };
  }
}
