/**
 * Worker Domain Mappers
 *
 * Shared mapping functions for transforming API/IPC responses to domain types.
 * Consolidates mapping logic to ensure consistency across adapters.
 *
 * Requirements: 7.1, 7.2 - Consistent data mapping
 */

import type { Worker, WorkerHealthMetrics, WorkerState } from './types';

/**
 * Map API state to UI state
 * API uses: initializing, ready, busy, unhealthy, terminated
 * UI uses: idle, running, stopping, stopped, error
 */
export function mapWorkerState(apiState: string): WorkerState {
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
 * Map health metrics from API response
 * Includes per-worker metrics (queueLength, processingLatencyMs, throughputTradesPerSecond)
 *
 * Requirements: 1.1, 2.2, 3.2 - Per-worker metrics mapping
 */
export function mapHealthMetrics(
  healthMetrics: Record<string, unknown> | null | undefined
): WorkerHealthMetrics | null {
  if (!healthMetrics) return null;

  return {
    totalTradesProcessed: (healthMetrics.totalTradesProcessed as number) ?? 0,
    eventsPublished: (healthMetrics.eventsPublished as number) ?? 0,
    averageProcessingTimeMs:
      (healthMetrics.averageProcessingTimeMs as number) ?? 0,
    memoryUsageBytes: (healthMetrics.memoryUsageBytes as number) ?? 0,
    cpuUsagePercent: (healthMetrics.cpuUsagePercent as number) ?? 0,
    errorCount: (healthMetrics.errorCount as number) ?? 0,
    // Per-worker metrics
    queueLength: (healthMetrics.queueLength as number) ?? 0,
    processingLatencyMs: (healthMetrics.processingLatencyMs as number) ?? 0,
    throughputTradesPerSecond:
      (healthMetrics.throughputTradesPerSecond as number) ?? 0,
  };
}

/**
 * Map API/IPC response to Worker domain type
 * Shared mapping function used by both IpcWorkerAdapter and WorkerController
 *
 * Requirements: 7.1, 7.2 - Consistent worker mapping
 */
export function mapWorkerFromResponse(data: Record<string, unknown>): Worker {
  const healthMetrics = data.healthMetrics as Record<string, unknown> | null;
  const mappedHealthMetrics = mapHealthMetrics(healthMetrics);

  // Extract memory usage for convenience
  const memoryUsageBytes = mappedHealthMetrics?.memoryUsageBytes;
  const memoryUsageMB = memoryUsageBytes
    ? memoryUsageBytes / (1024 * 1024)
    : undefined;

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
