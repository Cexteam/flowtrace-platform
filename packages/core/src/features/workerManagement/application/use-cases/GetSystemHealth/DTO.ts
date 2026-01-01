/**
 * DTOs for GetSystemHealth use case
 */

import {
  WorkerHealthStatus,
  SystemHealthOverview,
} from '../../ports/in/WorkerHealthMonitorPort.js';

/**
 * Result of getting system health
 */
export interface GetSystemHealthResult extends SystemHealthOverview {
  /** Timestamp when health was retrieved */
  retrievedAt: Date;
}

/**
 * Result of getting all workers' health status
 */
export interface GetAllWorkersHealthStatusResult {
  /** Map of worker ID to health status */
  workers: Map<string, WorkerHealthStatus>;
  /** Timestamp when status was retrieved */
  retrievedAt: Date;
}

/**
 * Result of getting unhealthy workers
 */
export interface GetUnhealthyWorkersResult {
  /** Array of unhealthy worker IDs */
  unhealthyWorkerIds: string[];
  /** Total count of unhealthy workers */
  count: number;
  /** Timestamp when status was retrieved */
  retrievedAt: Date;
}
