import { z } from 'zod';
import { cpus } from 'os';

/**
 * Server Environment Variables Schema
 *
 * Unified schema for all deployments.
 * Exchange-specific config (URLs, rate limits, sync settings) are stored in database.
 *
 */

/**
 * Default rotation config values
 * - TRIGGER: 22 hours (2 hour buffer before 24h Binance limit)
 * - OVERLAP: 10 minutes (time both connections are active)
 * - RETRY_INTERVAL: 5 minutes (retry interval if secondary fails)
 */
const DEFAULT_ROTATION_TRIGGER_MS = 79200000; // 22 hours
const DEFAULT_ROTATION_OVERLAP_MS = 600000; // 10 minutes
const DEFAULT_ROTATION_RETRY_INTERVAL_MS = 300000; // 5 minutes

/**
 * Environment schema - application-level settings only
 * Exchange-specific settings are in exchanges table
 */
export const envSchema = {
  // Environment mode validation
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  // SQLite Configuration
  SQLITE_PATH: z.string().optional(),

  // Worker Threads Configuration
  // Default: CPU count - 1 (minimum 1)
  WORKER_THREADS_COUNT: z
    .string()
    .transform((val) => {
      const num = parseInt(val);
      return num === 0 || isNaN(num) ? Math.max(1, cpus().length - 1) : num;
    })
    .default('0'),

  // Logging Configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_DIR: z.string().optional(),

  // Test mode - optional configs for development
  TEST_MODE_SKIP_VALIDATION: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // IPC Configuration for persistence service communication
  IPC_SOCKET_PATH: z.string().optional(),

  // WebSocket Rotation Configuration
  // Proactive dual-connection strategy for zero-gap reconnection
  WS_ROTATION_ENABLED: z
    .string()
    .transform((val) => val !== 'false')
    .default('true'),

  WS_ROTATION_TRIGGER_MS: z
    .string()
    .transform((val) => {
      const num = parseInt(val);
      return isNaN(num) ? DEFAULT_ROTATION_TRIGGER_MS : num;
    })
    .default(String(DEFAULT_ROTATION_TRIGGER_MS)),

  WS_ROTATION_OVERLAP_MS: z
    .string()
    .transform((val) => {
      const num = parseInt(val);
      return isNaN(num) ? DEFAULT_ROTATION_OVERLAP_MS : num;
    })
    .default(String(DEFAULT_ROTATION_OVERLAP_MS)),

  WS_ROTATION_RETRY_INTERVAL_MS: z
    .string()
    .transform((val) => {
      const num = parseInt(val);
      return isNaN(num) ? DEFAULT_ROTATION_RETRY_INTERVAL_MS : num;
    })
    .default(String(DEFAULT_ROTATION_RETRY_INTERVAL_MS)),
};

// Export for type inference
export type EnvSchema = typeof envSchema;
