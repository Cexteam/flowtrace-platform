/**
 * RuntimeDatabase Poller
 *
 * Polls the RuntimeDatabase queue for messages and processes them in batches.
 * This component runs in the persistence service to consume fallback messages.
 */

import type { PollerConfig, PollerConfigWithoutHandler } from './types.js';
import type { QueueMessageDTO } from '../../dto/dto.js';

export class RuntimeDatabasePoller {
  private running: boolean = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private readonly pollInterval: number;
  private readonly batchSize: number;
  private readonly database: PollerConfig['database'];
  private onMessage: PollerConfig['onMessage'] | null;

  constructor(config: PollerConfig | PollerConfigWithoutHandler) {
    this.database = config.database;
    this.pollInterval = config.pollInterval ?? 1000; // 1 second default
    this.batchSize = config.batchSize ?? 50;
    this.onMessage = 'onMessage' in config ? config.onMessage : null;
  }

  /**
   * Set the message handler callback.
   * Must be called before start() if not provided in constructor.
   */
  setOnMessage(handler: (message: QueueMessageDTO) => Promise<void>): void {
    this.onMessage = handler;
  }

  /**
   * Start polling the queue
   * @throws Error if onMessage handler is not set
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Poller is already running');
    }

    if (!this.onMessage) {
      throw new Error(
        'onMessage handler must be set before starting the poller'
      );
    }

    this.running = true;
    this.schedulePoll();
  }

  /**
   * Stop polling the queue
   */
  async stop(): Promise<void> {
    this.running = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Check if the poller is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Schedule the next poll
   */
  private schedulePoll(): void {
    if (!this.running) {
      return;
    }

    this.pollTimer = setTimeout(async () => {
      await this.poll();
      this.schedulePoll();
    }, this.pollInterval);
  }

  /**
   * Poll the queue and process messages
   */
  private async poll(): Promise<void> {
    try {
      const messages = this.database.dequeue(this.batchSize);

      for (const message of messages) {
        await this.processMessage(message);
      }

      // Run cleanup periodically (every 100 polls)
      if (Math.random() < 0.01) {
        this.database.cleanup(24); // Use default 24 hours retention
      }
    } catch (error) {
      console.error('Error polling database:', error);
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(message: QueueMessageDTO): Promise<void> {
    try {
      await this.onMessage!(message);
      this.database.markProcessed(message.id);
    } catch (error) {
      console.error('Error processing message:', error);
      // Don't mark as processed - will retry on next poll
    }
  }
}
