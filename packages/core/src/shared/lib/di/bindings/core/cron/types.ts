/**
 * Core Cron Infrastructure Types
 *
 * Defines DI symbols for shared cron scheduling infrastructure.
 * Used across all features that need task scheduling capabilities.
 *
 */

export const CRON_TYPES = {
  /** Cron scheduler port - shared infrastructure for task scheduling */
  CronSchedulerPort: Symbol.for('Core.CronSchedulerPort'),
} as const;
