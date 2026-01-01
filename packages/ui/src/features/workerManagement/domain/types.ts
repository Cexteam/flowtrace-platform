/**
 * Worker Management Domain Types
 *
 * Defines the domain entities and value objects for worker management.
 * These types represent the core business concepts.
 *
 */

/**
 * Worker state enum
 */
export type WorkerState = 'idle' | 'running' | 'stopping' | 'stopped' | 'error';

/**
 * Worker health status for color coding
 */
export type WorkerHealth = 'healthy' | 'warning' | 'error';

/**
 * Worker health metrics
 */
export interface WorkerHealthMetrics {
  totalTradesProcessed: number;
  eventsPublished: number;
  averageProcessingTimeMs: number;
  memoryUsageBytes: number;
  cpuUsagePercent: number;
  errorCount: number;
}

/**
 * Worker entity
 */
export interface Worker {
  workerId: string;
  state: WorkerState;
  symbolCount: number;
  uptimeSeconds: number;
  isReady: boolean;
  assignedSymbols: string[];
  lastActivityAt: Date | null;
  healthMetrics: WorkerHealthMetrics | null;
  createdAt: Date;
  // Additional fields for UI display (Requirements 6.1, 7.2)
  cpuUsage?: number; // CPU usage percentage
  memoryUsageMB?: number; // Memory usage in MB
  memoryUsagePercent?: number; // Memory usage percentage
  throughput?: number; // Messages per second
  health?: WorkerHealth; // Health status for color coding
}

/**
 * Worker spawn configuration
 */
export interface WorkerSpawnConfig {
  maxSymbols: number;
  memoryLimitMB: number;
  cpuThreshold: number;
}

/**
 * Default spawn configuration values
 */
export const DEFAULT_SPAWN_CONFIG: WorkerSpawnConfig = {
  maxSymbols: 50,
  memoryLimitMB: 512,
  cpuThreshold: 80,
};

/**
 * Worker spawn result
 */
export interface WorkerSpawnResult {
  workerId: string;
  success: boolean;
  message?: string;
}

/**
 * Worker filters for list queries
 */
export interface WorkerFilters {
  search?: string;
  status?: 'all' | 'running' | 'idle' | 'error';
}

/**
 * Paginated workers request
 */
export interface PaginatedWorkersRequest {
  page: number;
  pageSize: number;
  search?: string;
  status?: 'all' | 'running' | 'idle' | 'error';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated workers response
 */
export interface PaginatedWorkersResponse {
  workers: Worker[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

/**
 * Derive worker health status from metrics
 */
export function deriveWorkerHealth(worker: Worker): WorkerHealth {
  if (worker.state === 'error') return 'error';
  if (!worker.healthMetrics) return 'healthy';

  const { errorCount, memoryUsageBytes } = worker.healthMetrics;
  const memoryUsageMB = memoryUsageBytes / (1024 * 1024);

  // Error if error count > 10 or memory > 1GB
  if (errorCount > 10 || memoryUsageMB > 1024) return 'error';
  // Warning if error count > 0 or memory > 512MB
  if (errorCount > 0 || memoryUsageMB > 512) return 'warning';

  return 'healthy';
}
