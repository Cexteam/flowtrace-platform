/**
 * Core Cron Infrastructure Bindings
 *
 * Binds shared cron scheduling infrastructure for use across all features.
 * Provides singleton CronSchedulerPort implementation using node-cron.
 */

import { Container } from 'inversify';
import { CronSchedulerPort } from '../../../../../infrastructure/cron/CronSchedulerPort.js';
import { NodeCronSchedulerAdapter } from '../../../../../infrastructure/cron/NodeCronSchedulerAdapter.js';
import { CRON_TYPES } from './types.js';

/**
 * Bind core cron infrastructure
 *
 * Binds CronSchedulerPort to NodeCronSchedulerAdapter as singleton.
 * This allows all features to inject the same cron scheduler instance
 * for consistent task scheduling across the application.
 *
 * @param container - InversifyJS container
 */
export function bindCoreCron(container: Container): void {
  // Cron Scheduler - singleton shared across all features
  container
    .bind<CronSchedulerPort>(CRON_TYPES.CronSchedulerPort)
    .to(NodeCronSchedulerAdapter)
    .inSingletonScope();
}
