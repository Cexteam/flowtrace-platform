/**
 * RotationConfig - WebSocket Connection Rotation Configuration
 *
 * Provides configuration for proactive dual-connection strategy
 * to ensure zero-gap when Binance WebSocket combined stream
 * disconnects after 24h.
 *
 * Configuration is loaded from environment variables with sensible defaults.
 */

/**
 * Rotation configuration interface
 */
export interface RotationConfig {
  /** Enable/disable proactive rotation (default: true) */
  enabled: boolean;

  /**
   * Time after primary connection to trigger secondary creation (ms)
   * Default: 22 hours (79200000ms) - provides 2 hour buffer before 24h limit
   */
  triggerMs: number;

  /**
   * Time to keep both connections active before closing primary (ms)
   * Default: 10 minutes (600000ms)
   */
  overlapMs: number;

  /**
   * Retry interval if secondary connection fails (ms)
   * Default: 5 minutes (300000ms)
   * System will retry persistently until success or primary disconnects
   */
  retryIntervalMs: number;
}

/**
 * Default rotation config values
 */
const DEFAULTS = {
  TRIGGER_MS: 79200000, // 22 hours
  OVERLAP_MS: 600000, // 10 minutes
  RETRY_INTERVAL_MS: 300000, // 5 minutes
} as const;

/**
 * Get rotation configuration from environment variables
 *
 * Environment variables:
 * - WS_ROTATION_ENABLED: Enable/disable proactive rotation (default: true)
 * - WS_ROTATION_TRIGGER_MS: Time to trigger secondary creation (default: 22h)
 * - WS_ROTATION_OVERLAP_MS: Overlap duration (default: 10m)
 * - WS_ROTATION_RETRY_INTERVAL_MS: Retry interval (default: 5m)
 *
 * @returns RotationConfig with values from env or defaults
 */
export function getRotationConfig(): RotationConfig {
  return {
    enabled: process.env.WS_ROTATION_ENABLED !== 'false',
    triggerMs: parseIntWithDefault(
      process.env.WS_ROTATION_TRIGGER_MS,
      DEFAULTS.TRIGGER_MS
    ),
    overlapMs: parseIntWithDefault(
      process.env.WS_ROTATION_OVERLAP_MS,
      DEFAULTS.OVERLAP_MS
    ),
    retryIntervalMs: parseIntWithDefault(
      process.env.WS_ROTATION_RETRY_INTERVAL_MS,
      DEFAULTS.RETRY_INTERVAL_MS
    ),
  };
}

/**
 * Parse integer from string with fallback to default
 */
function parseIntWithDefault(
  value: string | undefined,
  defaultValue: number
): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Format milliseconds to human-readable string
 * Useful for logging
 */
export function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}
