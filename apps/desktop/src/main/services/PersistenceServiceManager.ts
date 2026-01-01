/**
 * PersistenceServiceManager
 *
 * Manages the persistence worker process lifecycle for the desktop application.
 * Handles:
 * - Starting the persistence worker as a forked child process
 * - Auto-restart on crash with rate limiting
 * - Graceful shutdown
 * - Health monitoring
 *
 * Validates: Requirements 8.1, 8.2, 8.3 (Desktop Persistence Integration)
 */

import { fork, ChildProcess } from 'child_process';
import { createLogger } from '@flowtrace/core';

const logger = createLogger('PersistenceServiceManager');

export interface PersistenceServiceManagerConfig {
  /**
   * Path to the persistence worker script
   */
  workerPath: string;

  /**
   * Maximum number of restart attempts within the rate limit window
   * @default 5
   */
  maxRestartAttempts?: number;

  /**
   * Time window (in milliseconds) for rate limiting restarts
   * @default 60000 (1 minute)
   */
  rateLimitWindow?: number;

  /**
   * Delay (in milliseconds) before attempting restart
   * @default 1000
   */
  restartDelay?: number;

  /**
   * Whether to enable auto-restart
   * @default true
   */
  autoRestart?: boolean;

  /**
   * Additional environment variables to pass to the worker process
   */
  env?: Record<string, string>;
}

export interface PersistenceServiceStatus {
  isRunning: boolean;
  pid: number | null;
  restartCount: number;
  lastRestartTime: number | null;
  lastError: string | null;
}

/**
 * PersistenceServiceManager
 *
 * Manages the lifecycle of the persistence worker process.
 */
export class PersistenceServiceManager {
  private worker: ChildProcess | null = null;
  private isStarted: boolean = false;
  private isStopping: boolean = false;
  private restartAttempts: number[] = []; // Timestamps of restart attempts
  private lastError: string | null = null;

  private readonly config: Required<
    Omit<PersistenceServiceManagerConfig, 'env'>
  > & {
    env: Record<string, string>;
  };

  constructor(config: PersistenceServiceManagerConfig) {
    this.config = {
      workerPath: config.workerPath,
      maxRestartAttempts: config.maxRestartAttempts ?? 5,
      rateLimitWindow: config.rateLimitWindow ?? 60000, // 1 minute
      restartDelay: config.restartDelay ?? 1000,
      autoRestart: config.autoRestart ?? true,
      env: config.env ?? {},
    };

    logger.info('PersistenceServiceManager created', {
      workerPath: this.config.workerPath,
      maxRestartAttempts: this.config.maxRestartAttempts,
      rateLimitWindow: this.config.rateLimitWindow,
      autoRestart: this.config.autoRestart,
    });
  }

  /**
   * Start the persistence worker process
   *
   * Forks a new child process running the persistence worker script.
   * Sets up event handlers for monitoring and auto-restart.
   *
   * Validates: Requirements 8.1 - Desktop app forks persistence worker
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('Persistence service already started');
      return;
    }

    logger.info('Starting persistence service...');

    try {
      // Fork the persistence worker process with custom env
      // Fork worker with env vars from config (computed by PathResolver)
      // Note: FLOWTRACE_MODE removed - unified architecture doesn't need it
      this.worker = fork(this.config.workerPath, [], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        env: {
          ...process.env,
          ...this.config.env,
          NODE_ENV: process.env.NODE_ENV || 'production',
        },
      });

      this.isStarted = true;
      this.isStopping = false;

      logger.info('Persistence worker forked', {
        pid: this.worker.pid,
        workerPath: this.config.workerPath,
      });

      // Setup event handlers
      this.setupWorkerHandlers();

      // Wait a bit to ensure worker starts successfully
      await this.waitForWorkerReady();

      logger.info('Persistence service started successfully', {
        pid: this.worker?.pid,
      });
    } catch (error) {
      this.isStarted = false;
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to start persistence service', error);
      throw error;
    }
  }

  /**
   * Stop the persistence worker process
   *
   * Sends SIGTERM to the worker for graceful shutdown.
   * Waits for the worker to exit, then forcefully kills if necessary.
   *
   * Validates: Requirements 8.3 - Graceful shutdown with SIGTERM
   */
  async stop(): Promise<void> {
    if (!this.isStarted || !this.worker) {
      logger.warn('Persistence service not started');
      return;
    }

    if (this.isStopping) {
      logger.warn('Persistence service already stopping');
      return;
    }

    this.isStopping = true;
    logger.info('Stopping persistence service...', { pid: this.worker.pid });

    try {
      // Send SIGTERM for graceful shutdown
      this.worker.kill('SIGTERM');

      // Wait for worker to exit (with timeout)
      await this.waitForWorkerExit(10000); // 10 second timeout

      logger.info('Persistence service stopped successfully');
    } catch (error) {
      logger.error('Error stopping persistence service', error);

      // Force kill if graceful shutdown failed
      if (this.worker && !this.worker.killed) {
        logger.warn('Force killing persistence worker');
        this.worker.kill('SIGKILL');
      }
    } finally {
      this.worker = null;
      this.isStarted = false;
      this.isStopping = false;
    }
  }

  /**
   * Get the current status of the persistence service
   */
  getStatus(): PersistenceServiceStatus {
    return {
      isRunning: this.isStarted && this.worker !== null && !this.worker.killed,
      pid: this.worker?.pid ?? null,
      restartCount: this.restartAttempts.length,
      lastRestartTime:
        this.restartAttempts.length > 0
          ? this.restartAttempts[this.restartAttempts.length - 1]
          : null,
      lastError: this.lastError,
    };
  }

  /**
   * Setup event handlers for the worker process
   */
  private setupWorkerHandlers(): void {
    if (!this.worker) return;

    // Handle worker messages
    this.worker.on('message', (message) => {
      logger.debug('Message from persistence worker', { message });
    });

    // Handle worker stdout
    this.worker.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        logger.info(`[PersistenceWorker] ${output}`);
      }
    });

    // Handle worker stderr
    this.worker.stderr?.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        logger.error(`[PersistenceWorker] ${output}`);
      }
    });

    // Handle worker exit
    this.worker.on('exit', (code, signal) => {
      logger.warn('Persistence worker exited', { code, signal });

      // Don't restart if we're intentionally stopping
      if (this.isStopping) {
        logger.info('Worker exit expected (stopping)');
        return;
      }

      // Handle unexpected exit
      this.handleWorkerCrash(code, signal);
    });

    // Handle worker errors
    this.worker.on('error', (error) => {
      logger.error('Persistence worker error', error);
      this.lastError = error.message;
    });
  }

  /**
   * Handle worker crash and attempt restart
   *
   * Implements auto-restart with rate limiting to prevent restart loops.
   */
  private handleWorkerCrash(
    code: number | null,
    signal: NodeJS.Signals | null
  ): void {
    this.worker = null;
    this.isStarted = false;

    logger.error('Persistence worker crashed', { code, signal });

    // Check if auto-restart is enabled
    if (!this.config.autoRestart) {
      logger.warn('Auto-restart disabled, not restarting worker');
      this.lastError = `Worker crashed with code ${code}, signal ${signal}`;
      return;
    }

    // Clean up old restart attempts outside the rate limit window
    const now = Date.now();
    this.restartAttempts = this.restartAttempts.filter(
      (timestamp) => now - timestamp < this.config.rateLimitWindow
    );

    // Check if we've exceeded max restart attempts
    if (this.restartAttempts.length >= this.config.maxRestartAttempts) {
      logger.error('Max restart attempts reached, giving up', {
        attempts: this.restartAttempts.length,
        maxAttempts: this.config.maxRestartAttempts,
        window: this.config.rateLimitWindow,
      });

      this.lastError = `Max restart attempts (${this.config.maxRestartAttempts}) reached within ${this.config.rateLimitWindow}ms`;

      // TODO: Notify user via Electron dialog or notification
      // This would require passing in an Electron app reference or event emitter
      logger.error(
        'CRITICAL: Persistence service failed to start after multiple attempts. User intervention required.'
      );

      return;
    }

    // Record this restart attempt
    this.restartAttempts.push(now);

    // Schedule restart with delay
    logger.info(
      `Scheduling restart attempt ${this.restartAttempts.length}/${this.config.maxRestartAttempts} in ${this.config.restartDelay}ms`
    );

    setTimeout(() => {
      logger.info('Attempting to restart persistence worker...');
      this.start().catch((error) => {
        logger.error('Failed to restart persistence worker', error);
        this.lastError =
          error instanceof Error ? error.message : 'Unknown error';
      });
    }, this.config.restartDelay);
  }

  /**
   * Wait for worker to be ready
   *
   * Simple delay to allow worker to initialize.
   * In a production system, this could wait for a health check or IPC message.
   */
  private async waitForWorkerReady(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, 2000); // 2 second delay
    });
  }

  /**
   * Wait for worker to exit
   *
   * Returns a promise that resolves when the worker exits or times out.
   */
  private async waitForWorkerExit(timeoutMs: number): Promise<void> {
    if (!this.worker) return;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker exit timeout'));
      }, timeoutMs);

      this.worker!.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
}
