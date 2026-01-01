/**
 * WorkerController - API Functions for Worker Management
 *
 * API functions that make HTTP requests (web) or IPC calls (Electron).
 * Automatically detects environment and uses appropriate adapter.
 * Follows the Controller → Hook → Component pattern.
 *
 */

import type {
  Worker,
  WorkerHealthMetrics,
  WorkerSpawnConfig,
  WorkerSpawnResult,
} from '../../domain/types';
import type {
  GetWorkersRequest,
  GetWorkersResponse,
} from '../../application/ports/out/WorkerApiPort';

/**
 * Server Action result type
 */
export interface ServerActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Electron API interface
 */
interface ElectronAPI {
  invoke: <T>(channel: string, data?: unknown) => Promise<T>;
}

/**
 * Check if running in Electron environment
 */
function isElectron(): boolean {
  return (
    typeof window !== 'undefined' &&
    'electron' in window &&
    typeof (window as unknown as { electron: ElectronAPI }).electron.invoke ===
      'function'
  );
}

/**
 * Get Electron API
 */
function getElectronAPI(): ElectronAPI {
  return (window as unknown as { electron: ElectronAPI }).electron;
}

/**
 * Get workers list
 *
 * @param request - Optional filter parameters
 * @returns Server action result with workers data
 */
export async function getWorkersAction(
  request?: GetWorkersRequest
): Promise<ServerActionResult<GetWorkersResponse>> {
  try {
    // Detect environment and use appropriate adapter
    if (isElectron()) {
      // Electron: Use IPC
      const api = getElectronAPI();
      const data = await api.invoke<{
        workers: Record<string, unknown>[];
        total: number;
        totalWorkers?: number;
        healthyWorkers?: number;
      }>('workers:getAll', request);

      const mappedWorkers = data.workers.map(mapWorkerFromApi);

      return {
        success: true,
        data: {
          workers: mappedWorkers,
          total: data.totalWorkers ?? data.total ?? data.workers.length,
        },
      };
    } else {
      // Web: Use HTTP
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      const params = new URLSearchParams();
      if (request?.state) params.append('state', request.state);
      if (request?.limit) params.append('limit', request.limit.toString());
      if (request?.offset) params.append('offset', request.offset.toString());

      const queryString = params.toString();
      const url = `${apiUrl}/workers${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        cache: 'no-store',
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch workers: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: {
          workers: data.workers.map(mapWorkerFromApi),
          total: data.total,
        },
      };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get worker by ID
 *
 * @param workerId - Worker ID
 * @returns Server action result with worker data
 */
export async function getWorkerByIdAction(
  workerId: string
): Promise<ServerActionResult<Worker>> {
  try {
    if (isElectron()) {
      // Electron: Use IPC
      const api = getElectronAPI();
      const data = await api.invoke<Record<string, unknown> | null>(
        'workers:getById',
        { workerId }
      );

      if (!data) {
        return {
          success: false,
          error: 'Worker not found',
        };
      }

      return {
        success: true,
        data: mapWorkerFromApi(data),
      };
    } else {
      // Web: Use HTTP
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/workers/${workerId}`, {
        cache: 'no-store',
      });

      if (response.status === 404) {
        return {
          success: false,
          error: 'Worker not found',
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch worker: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: mapWorkerFromApi(data),
      };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Spawn a new worker
 *
 * @param config - Worker spawn configuration
 * @returns Server action result with spawn result
 */
export async function spawnWorkerAction(
  config: WorkerSpawnConfig
): Promise<ServerActionResult<WorkerSpawnResult>> {
  try {
    if (isElectron()) {
      // Electron: Use IPC
      const api = getElectronAPI();
      const data = await api.invoke<WorkerSpawnResult>('workers:spawn', config);

      return {
        success: data.success,
        data,
        error: data.success ? undefined : data.message,
      };
    } else {
      // Web: Use HTTP
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/workers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error:
            data.message || `Failed to spawn worker: ${response.statusText}`,
        };
      }

      return {
        success: true,
        data: {
          workerId: data.workerId,
          success: true,
          message: data.message,
        },
      };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get worker health metrics
 *
 * @param workerId - Worker ID
 * @returns Server action result with health metrics
 */
export async function getWorkerHealthAction(
  workerId: string
): Promise<ServerActionResult<WorkerHealthMetrics>> {
  try {
    if (isElectron()) {
      // Electron: Use IPC
      const api = getElectronAPI();
      // API returns WorkerHealthResponseDto with nested healthMetrics
      const data = await api.invoke<{
        workerId: string;
        isHealthy: boolean;
        healthMetrics: WorkerHealthMetrics;
        lastHeartbeat: string;
      } | null>('workers:getHealth', { workerId });

      if (!data) {
        return {
          success: false,
          error: 'Worker health not found',
        };
      }

      // Extract healthMetrics from the response
      return {
        success: true,
        data: data.healthMetrics,
      };
    } else {
      // Web: Use HTTP
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/workers/${workerId}/health`, {
        cache: 'no-store',
      });

      if (response.status === 404) {
        return {
          success: false,
          error: 'Worker health not found',
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch worker health: ${response.statusText}`,
        };
      }

      const data = await response.json();
      // Extract healthMetrics from the response
      return {
        success: true,
        data: data.healthMetrics,
      };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Map API state to UI state
 * API uses: initializing, ready, busy, unhealthy, terminated
 * UI uses: idle, running, stopping, stopped, error
 */
function mapWorkerState(apiState: string): Worker['state'] {
  switch (apiState) {
    case 'ready':
      return 'idle';
    case 'busy':
      return 'running';
    case 'initializing':
      return 'idle';
    case 'unhealthy':
      return 'error';
    case 'terminated':
      return 'stopped';
    default:
      return 'idle';
  }
}

/**
 * Map API response to Worker domain type
 */
function mapWorkerFromApi(data: Record<string, unknown>): Worker {
  const healthMetrics = data.healthMetrics as Record<string, unknown> | null;

  // Extract memory usage for convenience
  const memoryUsageBytes = healthMetrics?.memoryUsageBytes as
    | number
    | undefined;
  const memoryUsageMB = memoryUsageBytes
    ? memoryUsageBytes / (1024 * 1024)
    : undefined;

  // Map health metrics
  const mappedHealthMetrics: WorkerHealthMetrics | null = healthMetrics
    ? {
        totalTradesProcessed:
          (healthMetrics.totalTradesProcessed as number) ?? 0,
        eventsPublished: (healthMetrics.eventsPublished as number) ?? 0,
        averageProcessingTimeMs:
          (healthMetrics.averageProcessingTimeMs as number) ?? 0,
        memoryUsageBytes: (healthMetrics.memoryUsageBytes as number) ?? 0,
        cpuUsagePercent: (healthMetrics.cpuUsagePercent as number) ?? 0,
        errorCount: (healthMetrics.errorCount as number) ?? 0,
      }
    : null;

  return {
    workerId: data.workerId as string,
    state: mapWorkerState(data.state as string),
    symbolCount: (data.symbolCount as number) ?? 0,
    uptimeSeconds: (data.uptimeSeconds as number) ?? 0,
    isReady: (data.isReady as boolean) ?? false,
    assignedSymbols: (data.assignedSymbols as string[]) || [],
    lastActivityAt: data.lastActivityAt
      ? new Date(data.lastActivityAt as string)
      : null,
    healthMetrics: mappedHealthMetrics,
    createdAt: data.createdAt ? new Date(data.createdAt as string) : new Date(),
    // CPU usage from healthMetrics.cpuUsagePercent
    cpuUsage: mappedHealthMetrics?.cpuUsagePercent,
    memoryUsageMB,
  };
}
