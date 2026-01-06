/**
 * IpcWorkerAdapter - IPC implementation of WorkerApiPort
 *
 * Implements WorkerApiPort for Desktop deployment using Electron IPC calls.
 * Uses shared mapWorkerFromResponse for consistent data mapping.
 *
 * Requirements: 7.1, 7.2 - Consistent data mapping
 */

import { injectable } from 'inversify';
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
import { mapWorkerFromResponse } from '../../../domain/mappers';

/**
 * Electron IPC API interface
 */
interface ElectronAPI {
  invoke: <T>(channel: string, data?: unknown) => Promise<T>;
}

/**
 * Get the Electron API from window
 * Note: preload.ts exposes API as 'electron', not 'electronAPI'
 */
function getElectronAPI(): ElectronAPI {
  if (typeof window === 'undefined' || !('electron' in window)) {
    throw new Error(
      'Electron IPC not available - not running in Electron environment'
    );
  }
  return (window as unknown as { electron: ElectronAPI }).electron;
}

/**
 * IPC adapter for worker API operations
 *
 * Makes IPC calls to the Electron main process for worker management.
 */
@injectable()
export class IpcWorkerAdapter implements WorkerApiPort {
  /**
   * Get all workers with optional filtering
   */
  async getWorkers(request?: GetWorkersRequest): Promise<GetWorkersResponse> {
    const api = getElectronAPI();
    const data = await api.invoke<{
      workers: Record<string, unknown>[];
      total: number;
    }>('workers:getAll', request);

    return {
      workers: data.workers.map(mapWorkerFromResponse),
      total: data.total,
    };
  }

  /**
   * Get a specific worker by ID
   */
  async getWorkerById(workerId: string): Promise<Worker | null> {
    const api = getElectronAPI();
    const data = await api.invoke<Record<string, unknown> | null>(
      'workers:getById',
      { workerId }
    );

    if (!data) {
      return null;
    }

    return mapWorkerFromResponse(data);
  }

  /**
   * Spawn a new worker with the given configuration
   */
  async spawnWorker(config: WorkerSpawnConfig): Promise<WorkerSpawnResult> {
    const api = getElectronAPI();
    return api.invoke<WorkerSpawnResult>('workers:spawn', config);
  }

  /**
   * Get health metrics for a specific worker
   */
  async getWorkerHealth(workerId: string): Promise<WorkerHealthMetrics | null> {
    const api = getElectronAPI();
    return api.invoke<WorkerHealthMetrics | null>('workers:getHealth', {
      workerId,
    });
  }
}
