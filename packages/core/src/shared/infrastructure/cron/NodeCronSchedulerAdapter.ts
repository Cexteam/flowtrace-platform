/**
 * Node Cron Scheduler Adapter
 *
 * Infrastructure adapter that implements CronSchedulerPort using node-cron library.
 * Provides shared cron scheduling capabilities for all features.
 *
 * This is a singleton service that manages all scheduled tasks across
 * the entire application, ensuring no conflicts between features.
 */

import * as cron from 'node-cron';
import { injectable } from 'inversify';
import { CronSchedulerPort } from './CronSchedulerPort.js';
import { createLogger } from '../../lib/logger/logger.js';

const logger = createLogger('NodeCronSchedulerAdapter');

@injectable()
export class NodeCronSchedulerAdapter implements CronSchedulerPort {
  private tasks: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Schedule a recurring task
   */
  async scheduleRecurring(
    schedule: string,
    taskId: string,
    callback: () => Promise<void>
  ): Promise<void> {
    // Check if task already exists
    if (this.tasks.has(taskId)) {
      logger.warn(`Task ${taskId} already scheduled, stopping existing task`);
      await this.cancelSchedule(taskId);
    }

    // Validate cron expression
    if (!cron.validate(schedule)) {
      throw new Error(`Invalid cron expression: ${schedule}`);
    }

    logger.info(`📅 Scheduling task '${taskId}' with pattern '${schedule}'`);

    // Create scheduled task
    const task = cron.schedule(
      schedule,
      async () => {
        logger.debug(`🕐 Executing scheduled task: ${taskId}`);

        const startTime = Date.now();
        try {
          await callback();
          const duration = Date.now() - startTime;
          logger.debug(
            `✅ Task ${taskId} completed successfully in ${duration}ms`
          );
        } catch (error) {
          const duration = Date.now() - startTime;
          logger.error(`❌ Task ${taskId} failed after ${duration}ms:`, error);
          // Don't rethrow - let cron continue running
        }
      },
      {
        scheduled: false, // Don't start immediately
        timezone: 'UTC', // Use UTC timezone for consistency
      }
    );

    // Store task and start it
    this.tasks.set(taskId, task);
    task.start();

    logger.info(`✅ Task '${taskId}' scheduled successfully`);
  }

  /**
   * Cancel a scheduled task
   */
  async cancelSchedule(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);

    if (task) {
      task.stop();
      this.tasks.delete(taskId);
      logger.info(`🛑 Cancelled scheduled task: ${taskId}`);
    } else {
      logger.warn(`Task ${taskId} not found, nothing to cancel`);
    }
  }

  /**
   * Get status of a specific task
   */
  getTaskStatus(taskId: string): { isActive: boolean; nextRun?: Date } {
    const task = this.tasks.get(taskId);

    if (!task) {
      return { isActive: false };
    }

    // node-cron doesn't provide status or nextRun directly
    // We track active status based on whether task exists in our map
    return {
      isActive: true, // If task exists in map, it's considered active
      // nextRun calculation would require custom logic
      // or using a different cron library like 'cron' or 'bull'
    };
  }

  /**
   * Get all scheduled tasks
   */
  getAllTasks(): Record<string, { isActive: boolean; schedule?: string }> {
    const result: Record<string, { isActive: boolean; schedule?: string }> = {};

    for (const [taskId] of this.tasks) {
      result[taskId] = {
        isActive: true, // If task exists in map, it's considered active
        // schedule pattern not available from node-cron task object
      };
    }

    return result;
  }

  /**
   * Shutdown all tasks (graceful shutdown)
   */
  async shutdown(): Promise<void> {
    const taskCount = this.tasks.size;

    if (taskCount === 0) {
      logger.info('No scheduled tasks to shutdown');
      return;
    }

    logger.info(`🛑 Shutting down ${taskCount} scheduled tasks...`);

    // Cancel all tasks
    const taskIds = Array.from(this.tasks.keys());
    for (const taskId of taskIds) {
      await this.cancelSchedule(taskId);
    }

    logger.info('✅ All scheduled tasks stopped');
  }
}
