/**
 * Cron Scheduler Port - Outbound Port
 *
 * Defines the contract for task scheduling infrastructure.
 * This is a shared infrastructure port used across all features
 * that need recurring task scheduling capabilities.
 *
 * Hexagonal Architecture: This is an outbound port
 * - Application layer defines the interface
 * - Infrastructure layer implements it (NodeCronSchedulerAdapter)
 */

export interface CronSchedulerPort {
  /**
   * Schedule a recurring task
   *
   * @param schedule - Cron expression (e.g., '0 * * * *' for every hour)
   * @param taskId - Unique task identifier across all features
   * @param callback - Function to execute when cron triggers
   * @throws Error if cron expression is invalid or taskId already exists
   */
  scheduleRecurring(
    schedule: string,
    taskId: string,
    callback: () => Promise<void>
  ): Promise<void>;

  /**
   * Cancel a scheduled task
   *
   * @param taskId - Task identifier to cancel
   */
  cancelSchedule(taskId: string): Promise<void>;

  /**
   * Get status of a specific task
   *
   * @param taskId - Task identifier
   * @returns Task status information
   */
  getTaskStatus(taskId: string): {
    isActive: boolean;
    nextRun?: Date;
  };

  /**
   * Get all scheduled tasks across all features
   *
   * @returns Map of task IDs to their status
   */
  getAllTasks(): Record<
    string,
    {
      isActive: boolean;
      schedule?: string;
    }
  >;

  /**
   * Shutdown all scheduled tasks
   * Used for graceful application shutdown
   */
  shutdown(): Promise<void>;
}
