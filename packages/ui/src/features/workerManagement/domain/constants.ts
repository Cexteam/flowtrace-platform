/**
 * Worker Health Monitoring Constants
 *
 * Defines threshold constants for overload detection and visual indicators.
 * These thresholds are used across UI components for consistent behavior.
 *
 * Requirements: 4.3, 4.5, 5.2, 5.3, 5.4
 */

/**
 * Queue length thresholds for overload detection
 * - Normal: queue <= WARNING (10)
 * - Warning: queue > WARNING and <= CRITICAL (50)
 * - Critical: queue > CRITICAL (50)
 */
export const QUEUE_LENGTH_THRESHOLDS = {
  /** Warning threshold - queue is getting backed up */
  WARNING: 10,
  /** Critical threshold - worker is overloaded */
  CRITICAL: 50,
} as const;

/**
 * Processing latency thresholds in milliseconds
 * - Normal: latency <= WARNING (1000ms)
 * - Warning: latency > WARNING and <= CRITICAL (5000ms)
 * - Critical: latency > CRITICAL (5000ms)
 */
export const PROCESSING_LATENCY_THRESHOLDS = {
  /** Warning threshold - processing is slow (1 second) */
  WARNING: 1000,
  /** Critical threshold - processing is critically slow (5 seconds) */
  CRITICAL: 5000,
} as const;

/**
 * Throughput thresholds in trades per second
 * - Critical: throughput < CRITICAL (1 trade/sec)
 * - Warning: throughput < WARNING (10 trades/sec)
 * - Good: throughput >= GOOD (100 trades/sec)
 */
export const THROUGHPUT_THRESHOLDS = {
  /** Critical threshold - very low throughput */
  CRITICAL: 1,
  /** Warning threshold - low throughput */
  WARNING: 10,
  /** Good threshold - healthy throughput */
  GOOD: 100,
} as const;

/**
 * Memory usage thresholds in percentage (of 1GB limit)
 */
export const MEMORY_THRESHOLDS = {
  /** Warning threshold - 80% of limit */
  WARNING: 80,
  /** Critical threshold - 95% of limit */
  CRITICAL: 95,
  /** Assumed memory limit in bytes (1GB) */
  LIMIT_BYTES: 1024 * 1024 * 1024,
} as const;

/**
 * CPU usage thresholds in percentage
 */
export const CPU_THRESHOLDS = {
  /** Warning threshold - 80% CPU usage */
  WARNING: 80,
  /** Critical threshold - 95% CPU usage */
  CRITICAL: 95,
} as const;

/**
 * Error count thresholds
 */
export const ERROR_COUNT_THRESHOLDS = {
  /** Warning threshold - any errors */
  WARNING: 0,
  /** Critical threshold - many errors */
  CRITICAL: 10,
} as const;

/**
 * Variant type for visual indicators
 */
export type HealthVariant = 'default' | 'success' | 'warning' | 'error';

/**
 * Get variant based on queue length thresholds
 */
export function getQueueLengthVariant(queueLength: number): HealthVariant {
  if (queueLength > QUEUE_LENGTH_THRESHOLDS.CRITICAL) return 'error';
  if (queueLength > QUEUE_LENGTH_THRESHOLDS.WARNING) return 'warning';
  return 'default';
}

/**
 * Get status text for queue length
 */
export function getQueueLengthStatus(queueLength: number): string {
  if (queueLength > QUEUE_LENGTH_THRESHOLDS.CRITICAL) return 'Overloaded!';
  if (queueLength > QUEUE_LENGTH_THRESHOLDS.WARNING) return 'High backlog';
  return 'Normal';
}

/**
 * Get variant based on processing latency thresholds
 */
export function getLatencyVariant(latencyMs: number): HealthVariant {
  if (latencyMs > PROCESSING_LATENCY_THRESHOLDS.CRITICAL) return 'error';
  if (latencyMs > PROCESSING_LATENCY_THRESHOLDS.WARNING) return 'warning';
  return 'default';
}

/**
 * Get status text for processing latency
 */
export function getLatencyStatus(latencyMs: number): string {
  if (latencyMs > PROCESSING_LATENCY_THRESHOLDS.CRITICAL) return 'Critical!';
  if (latencyMs > PROCESSING_LATENCY_THRESHOLDS.WARNING) return 'Slow';
  return 'Normal';
}

/**
 * Get variant based on throughput thresholds
 */
export function getThroughputVariant(throughput: number): HealthVariant {
  if (throughput < THROUGHPUT_THRESHOLDS.CRITICAL) return 'warning';
  if (throughput >= THROUGHPUT_THRESHOLDS.GOOD) return 'success';
  return 'default';
}

/**
 * Get variant based on CPU usage thresholds
 */
export function getCpuVariant(cpuPercent: number | undefined): HealthVariant {
  if (cpuPercent === undefined) return 'default';
  if (cpuPercent > CPU_THRESHOLDS.CRITICAL) return 'error';
  if (cpuPercent > CPU_THRESHOLDS.WARNING) return 'warning';
  return 'default';
}

/**
 * Get variant based on memory usage thresholds
 */
export function getMemoryVariant(memoryPercent: number): HealthVariant {
  if (memoryPercent > MEMORY_THRESHOLDS.CRITICAL) return 'error';
  if (memoryPercent > MEMORY_THRESHOLDS.WARNING) return 'warning';
  return 'default';
}

/**
 * Get variant based on error count thresholds
 */
export function getErrorCountVariant(errorCount: number): HealthVariant {
  if (errorCount > ERROR_COUNT_THRESHOLDS.CRITICAL) return 'error';
  if (errorCount > ERROR_COUNT_THRESHOLDS.WARNING) return 'warning';
  return 'default';
}

/**
 * Check if worker is in overload state based on metrics
 */
export function isWorkerOverloaded(metrics: {
  queueLength?: number;
  processingLatencyMs?: number;
  throughputTradesPerSecond?: number;
}): boolean {
  const { queueLength = 0, processingLatencyMs = 0 } = metrics;

  return (
    queueLength > QUEUE_LENGTH_THRESHOLDS.CRITICAL ||
    processingLatencyMs > PROCESSING_LATENCY_THRESHOLDS.CRITICAL
  );
}

/**
 * Check if worker is in warning state based on metrics
 */
export function isWorkerWarning(metrics: {
  queueLength?: number;
  processingLatencyMs?: number;
  throughputTradesPerSecond?: number;
}): boolean {
  const {
    queueLength = 0,
    processingLatencyMs = 0,
    throughputTradesPerSecond = Infinity,
  } = metrics;

  return (
    queueLength > QUEUE_LENGTH_THRESHOLDS.WARNING ||
    processingLatencyMs > PROCESSING_LATENCY_THRESHOLDS.WARNING ||
    throughputTradesPerSecond < THROUGHPUT_THRESHOLDS.CRITICAL
  );
}
