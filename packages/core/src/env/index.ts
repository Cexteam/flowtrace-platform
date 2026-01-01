/**
 * Environment Configuration with Zod Validation
 *
 * Unified schema for all deployments.
 * Exchange-specific config (URLs, rate limits, sync settings) are stored in database.
 *
 * LAZY LOADING: Environment is only validated when getEnv() is called.
 *
 */
import { config } from 'dotenv';
import { z } from 'zod';
import { envSchema } from './server.js';

// Create Zod validation object from schema
const zodEnvSchema = z.object(envSchema);

// Cached validated environment
let _validatedEnv: z.infer<typeof zodEnvSchema> | null = null;
let _validationAttempted = false;

/**
 * Validate and get environment variables (lazy loading)
 * Only validates on first call, caches result for subsequent calls.
 *
 */
function validateEnv(): z.infer<typeof zodEnvSchema> {
  if (_validatedEnv !== null) {
    return _validatedEnv;
  }

  if (_validationAttempted) {
    throw new Error(
      'Environment validation failed - check configuration above'
    );
  }

  _validationAttempted = true;

  // Load .env file only if critical env vars are not already set
  // This allows apps (like desktop) to set env vars before importing core
  if (!process.env.NODE_ENV) {
    config();
  }

  const result = zodEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,

    SQLITE_PATH: process.env.SQLITE_PATH,

    WORKER_THREADS_COUNT: process.env.WORKER_THREADS_COUNT,

    LOG_LEVEL: process.env.LOG_LEVEL,
    LOG_DIR: process.env.LOG_DIR,

    TEST_MODE_SKIP_VALIDATION: process.env.TEST_MODE_SKIP_VALIDATION,
    IPC_SOCKET_PATH: process.env.IPC_SOCKET_PATH,
  });

  // Handle validation errors
  if (!result.success) {
    const errors = result.error.issues
      .map((issue: any) => `❌ ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.error('🚨 Environment validation failed:\n', errors);

    if (process.env.NODE_ENV === 'production') {
      console.error(
        '💥 Production startup aborted due to env validation errors'
      );
      process.exit(1);
    } else {
      console.warn(
        '⚠️ Development mode: continuing with env issues (check warnings above)'
      );
    }

    throw new Error(
      'Environment validation failed - check configuration above'
    );
  }

  _validatedEnv = result.data;
  return _validatedEnv;
}

/**
 * Get validated environment (lazy loading)
 * Use this function instead of direct `env` access for lazy validation.
 */
export function getEnv(): z.infer<typeof zodEnvSchema> {
  return validateEnv();
}

/**
 * Check if environment has been validated
 */
export function isEnvValidated(): boolean {
  return _validatedEnv !== null;
}

// Export validated environment as a getter for backward compatibility
export const env = new Proxy({} as z.infer<typeof zodEnvSchema>, {
  get(_target, prop) {
    return validateEnv()[prop as keyof z.infer<typeof zodEnvSchema>];
  },
});

// Export types for enhanced TypeScript experience
export type AppEnv = typeof env;
