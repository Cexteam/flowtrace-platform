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
};

// Export for type inference
export type EnvSchema = typeof envSchema;
