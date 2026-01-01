/**
 * FlowTraceApplication - Application Lifecycle Manager
 *
 * Manages the lifecycle of all core services:
 * - Database initialization and migrations (SQLite)
 * - Symbol synchronization from exchanges
 * - Worker pool management
 * - Trade ingestion via WebSocket
 * - Worker health monitoring
 *
 * Startup Sequence:
 * 1. Run database migrations
 * 2. Start symbol sync and wait for initial sync
 * 3. Initialize worker pool with IPC socket path
 * 4. Start trade ingestion (WebSocket → Workers → IPC)
 * 5. Start worker health monitoring
 *
 * Usage:
 * ```typescript
 * const { app } = await bootstrap();
 * // App is running...
 * await app.stop();
 * ```
 */

import { injectable, inject, optional, Container } from 'inversify';
import { createLogger } from '../lib/logger/logger.js';
import { TYPES, WORKER_MANAGEMENT_TYPES } from '../lib/di/index.js';
import { DATABASE_SYMBOLS } from '../lib/di/bindings/core/database/types.js';
import { bootstrapDatabaseLazy } from '../infrastructure/database/index.js';
import type { DrizzleDatabase } from '../infrastructure/database/drizzle/types.js';
import type { SymbolManagementPort } from '../../features/symbolManagement/index.js';
import type {
  WorkerHealthMonitorPort,
  WorkerPoolPort,
  WorkerPoolConfig,
  WorkerCommunicationPort,
} from '../../features/workerManagement/application/index.js';
import type { TradeIngestionPort } from '../../features/marketData/application/ports/in/TradeIngestionPort.js';
import { env } from '../../env/index.js';

const logger = createLogger('FlowTraceApplication');

/**
 * Application startup options
 */
export interface FlowTraceApplicationOptions {
  /** Run database migrations on startup (default: true) */
  runMigrations?: boolean;
  /** Fail startup if migrations fail (default: true in production) */
  failOnMigrationError?: boolean;
  /** Enable symbol sync from exchanges (default: true) */
  enableSymbolSync?: boolean;
  /** Enable trade ingestion via WebSocket (default: true) */
  enableTradeIngestion?: boolean;
  /** Enable worker pool (default: false, TradeIngestionService handles this) */
  enableWorkerPool?: boolean;
  /** Enable worker health monitoring (default: true) */
  enableHealthMonitoring?: boolean;
  /** Delay before initial symbol sync in ms (default: 3000) */
  symbolSyncDelayMs?: number;
  /** IPC socket path for candle events */
  socketPath?: string;
  /** Timeout for workers to be ready in ms (default: 10000) */
  workerReadyTimeoutMs?: number;
  /** Timeout for graceful shutdown flush in ms (default: 10000) */
  shutdownFlushTimeoutMs?: number;
}

/**
 * Application status
 */
export interface FlowTraceApplicationStatus {
  isRunning: boolean;
  symbolSyncEnabled: boolean;
  tradeIngestionEnabled: boolean;
  workerPoolEnabled: boolean;
  healthMonitoringEnabled: boolean;
  workerCount: number;
  startedAt?: Date;
}

/**
 * FlowTraceApplication - Application lifecycle manager
 *
 * Usage:
 * ```typescript
 * const { app } = await bootstrap();
 * // App is running...
 * await app.stop();
 * ```
 */
@injectable()
export class FlowTraceApplication {
  private isRunning = false;
  private startedAt?: Date;
  private options: FlowTraceApplicationOptions = {};
  private containerRef?: Container;
  private workerCount = 0;
  private shutdownInProgress = false;

  constructor(
    @inject(TYPES.SymbolManagementPort)
    @optional()
    private symbolManagement?: SymbolManagementPort,

    @inject(TYPES.TradeIngestionPort)
    @optional()
    private tradeIngestion?: TradeIngestionPort,

    @inject(WORKER_MANAGEMENT_TYPES.WorkerHealthMonitorPort)
    @optional()
    private workerHealthMonitor?: WorkerHealthMonitorPort,

    @inject(WORKER_MANAGEMENT_TYPES.WorkerPoolPort)
    @optional()
    private workerPoolPort?: WorkerPoolPort,

    @inject(WORKER_MANAGEMENT_TYPES.WorkerCommunicationPort)
    @optional()
    private workerCommunicationPort?: WorkerCommunicationPort
  ) {
    // Register shutdown handlers
    this.registerShutdownHandlers();
  }

  /**
   * Set the container reference for database operations
   * Called by ContainerFactory after binding
   */
  setContainer(container: Container): void {
    this.containerRef = container;
  }

  /**
   * Get default options based on environment
   */
  private getDefaultOptions(): FlowTraceApplicationOptions {
    // Get socket path from environment or use default
    const socketPath = env.IPC_SOCKET_PATH || '/tmp/flowtrace-persistence.sock';

    return {
      runMigrations: true,
      failOnMigrationError: process.env.NODE_ENV === 'production',
      enableSymbolSync: true,
      enableTradeIngestion: true,
      enableWorkerPool: false, // Workers are initialized by TradeIngestionService
      enableHealthMonitoring: true,
      symbolSyncDelayMs: 3000,
      socketPath,
      workerReadyTimeoutMs: 10000,
      shutdownFlushTimeoutMs: 10000,
    };
  }

  /**
   * Start all application services
   *
   * @param options - Startup options (merged with platform defaults)
   * @throws Error if already running or if critical services fail to start
   *
   */
  async start(options: FlowTraceApplicationOptions = {}): Promise<void> {
    if (this.isRunning) {
      logger.warn('FlowTraceApplication is already running');
      return;
    }

    // Merge with platform-specific defaults
    this.options = {
      ...this.getDefaultOptions(),
      ...options,
    };

    logger.info('Starting FlowTraceApplication...', {
      options: this.options,
    });

    try {
      // Step 1: Run database migrations (if container is available)
      if (this.options.runMigrations && this.containerRef) {
        logger.info('Running database migrations...');
        const migrationResult = await bootstrapDatabaseLazy(this.containerRef, {
          runMigrations: true,
          failOnMigrationError: this.options.failOnMigrationError,
        });

        if (!migrationResult.success) {
          const errorMsg = `Database migration failed: ${migrationResult.error}`;
          if (this.options.failOnMigrationError) {
            throw new Error(errorMsg);
          }
          logger.warn(errorMsg + ' (continuing anyway)');
        } else {
          logger.info('Database migrations completed successfully');
        }
      }

      // Step 2: Start symbol sync cron job
      if (this.options.enableSymbolSync && this.symbolManagement) {
        logger.info('Starting symbol sync cron job...');
        await this.symbolManagement.startScheduledSync();

        // Wait for initial symbol sync
        if (
          this.options.symbolSyncDelayMs &&
          this.options.symbolSyncDelayMs > 0
        ) {
          logger.info(
            `Waiting for initial symbol sync (${this.options.symbolSyncDelayMs}ms)...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, this.options.symbolSyncDelayMs)
          );

          // Run initial sync
          await this.symbolManagement.runSyncNow();
          logger.info('Initial symbol sync completed');
        }
      } else if (this.options.enableSymbolSync) {
        logger.warn(
          'Symbol management service not available (not bound in container)'
        );
      }

      // Step 3: Initialize worker pool (if not using trade ingestion which does it automatically)
      if (
        this.options.enableWorkerPool &&
        !this.options.enableTradeIngestion &&
        this.workerPoolPort
      ) {
        logger.info('Initializing worker pool...');
        await this.initializeWorkerPool();
        logger.info(`Worker pool initialized with ${this.workerCount} workers`);
      } else if (
        this.options.enableWorkerPool &&
        !this.options.enableTradeIngestion
      ) {
        logger.warn('Worker pool not available (not bound in container)');
      }

      // Step 4: Start trade ingestion (this also initializes worker pool if enabled)
      if (this.options.enableTradeIngestion && this.tradeIngestion) {
        logger.info('Starting trade ingestion pipeline...');
        const ingestionResult = await this.tradeIngestion.startIngestion();
        if (!ingestionResult.success) {
          throw new Error(`Trade ingestion failed: ${ingestionResult.message}`);
        }
        logger.info('Trade ingestion started successfully');
      } else if (this.options.enableTradeIngestion) {
        logger.warn('Trade ingestion not available (not bound in container)');
      }

      // Step 5: Start worker health monitoring
      if (this.options.enableHealthMonitoring && this.workerHealthMonitor) {
        logger.info('Starting worker health monitoring...');
        this.workerHealthMonitor.startMonitoring();
        logger.info('Worker health monitoring started');
      } else if (this.options.enableHealthMonitoring) {
        logger.warn(
          'Worker health monitor not available (not bound in container)'
        );
      }

      this.isRunning = true;
      this.startedAt = new Date();

      logger.info('FlowTraceApplication started successfully', {
        startedAt: this.startedAt,
        features: {
          migrations: this.options.runMigrations,
          symbolSync: this.options.enableSymbolSync && !!this.symbolManagement,
          tradeIngestion:
            this.options.enableTradeIngestion && !!this.tradeIngestion,
          workerPool:
            (this.options.enableWorkerPool ||
              this.options.enableTradeIngestion) &&
            !!this.workerPoolPort,
          workerCount: this.workerCount,
          healthMonitoring:
            this.options.enableHealthMonitoring && !!this.workerHealthMonitor,
        },
      });
    } catch (error) {
      logger.error('Failed to start FlowTraceApplication', error);
      // Attempt cleanup on failure
      await this.stop();
      throw error;
    }
  }

  /**
   * Stop all application services gracefully
   *
   */
  async stop(): Promise<void> {
    if (!this.isRunning && !this.shutdownInProgress) {
      logger.debug('FlowTraceApplication is not running');
      return;
    }

    // Prevent multiple shutdown calls
    if (this.shutdownInProgress) {
      logger.debug('Shutdown already in progress');
      return;
    }

    this.shutdownInProgress = true;
    logger.info('Stopping FlowTraceApplication...');

    // Stop symbol sync cron job
    if (this.symbolManagement) {
      try {
        await this.symbolManagement.stopScheduledSync();
        logger.info('Symbol sync cron job stopped');
      } catch (error) {
        logger.error('Error stopping symbol sync cron job', error);
      }
    }

    // Stop worker health monitoring
    if (this.workerHealthMonitor) {
      try {
        this.workerHealthMonitor.stopMonitoring();
        logger.info('Worker health monitoring stopped');
      } catch (error) {
        logger.error('Error stopping worker health monitoring', error);
      }
    }

    // Stop trade ingestion (stops WebSocket streams)
    if (this.tradeIngestion) {
      try {
        await this.tradeIngestion.stopIngestion();
        logger.info('Trade ingestion stopped');
      } catch (error) {
        logger.error('Error stopping trade ingestion', error);
      }
    }

    // Signal workers to flush dirty states before shutdown
    if (this.workerPoolPort && this.workerCommunicationPort) {
      try {
        await this.signalWorkersToFlush();
        logger.info('All workers flushed dirty states');
      } catch (error) {
        logger.error('Error flushing worker states on shutdown', error);
      }
    }

    // Shutdown worker pool (terminate all worker threads)
    if (this.workerPoolPort) {
      try {
        await this.workerPoolPort.shutdown();
        logger.info('Worker pool shutdown complete');
      } catch (error) {
        logger.error('Error shutting down worker pool', error);
      }
    }

    // Close database connection
    if (
      this.containerRef &&
      this.containerRef.isBound(DATABASE_SYMBOLS.DrizzleDatabase)
    ) {
      try {
        const db = this.containerRef.get<DrizzleDatabase>(
          DATABASE_SYMBOLS.DrizzleDatabase
        );
        if (db && typeof db.close === 'function') {
          await db.close();
          logger.info('Database connection closed');
        }
      } catch (error) {
        logger.error('Error closing database connection', error);
      }
    }

    this.isRunning = false;
    this.shutdownInProgress = false;
    logger.info('FlowTraceApplication stopped successfully');
  }

  /**
   * Get the current application status
   */
  getStatus(): FlowTraceApplicationStatus {
    return {
      isRunning: this.isRunning,
      symbolSyncEnabled:
        this.options.enableSymbolSync !== false && !!this.symbolManagement,
      tradeIngestionEnabled:
        this.options.enableTradeIngestion !== false && !!this.tradeIngestion,
      workerPoolEnabled:
        (this.options.enableWorkerPool !== false ||
          this.options.enableTradeIngestion !== false) &&
        !!this.workerPoolPort,
      healthMonitoringEnabled:
        this.options.enableHealthMonitoring !== false &&
        !!this.workerHealthMonitor,
      workerCount: this.workerCount,
      startedAt: this.startedAt,
    };
  }

  /**
   * Initialize worker pool with auto-detected worker count
   * Uses WORKER_THREADS_COUNT env var, defaults to 2 if not set
   *
   */
  private async initializeWorkerPool(): Promise<void> {
    if (!this.workerPoolPort) {
      throw new Error('WorkerPoolPort not available');
    }

    // Use env var or default to 2 workers (same logic as flowtrace)
    const numWorkers = env.WORKER_THREADS_COUNT || 2;
    const socketPath =
      this.options.socketPath ||
      env.IPC_SOCKET_PATH ||
      '/tmp/flowtrace-persistence.sock';
    this.workerCount = numWorkers;

    logger.info(
      `🚀 Initializing ${numWorkers} worker threads via WorkerPoolPort (socketPath: ${socketPath})...`
    );

    try {
      const config: WorkerPoolConfig = {
        workerCount: numWorkers,
        // workerScript not needed - adapter uses getDefaultWorkerScriptPath() automatically
        socketPath, // Pass socketPath for IPC-based persistence
        readyTimeout: this.options.workerReadyTimeoutMs,
      };

      await this.workerPoolPort.initialize(config);

      const status = this.workerPoolPort.getStatus();
      logger.info(
        `🚀 Worker pool initialization complete: ${status.healthyWorkers}/${status.totalWorkers} workers healthy`
      );
    } catch (error) {
      logger.error('❌ Failed to initialize worker pool', error);
      throw error;
    }
  }

  /**
   * Check if the application is healthy
   */
  isHealthy(): boolean {
    if (!this.isRunning) {
      return false;
    }

    // Check trade ingestion health if enabled
    if (this.options.enableTradeIngestion && this.tradeIngestion) {
      if (!this.tradeIngestion.isHealthy()) {
        return false;
      }
    }

    return true;
  }

  /**
   * Register shutdown handlers for SIGTERM and SIGINT
   *
   */
  private registerShutdownHandlers(): void {
    const handleShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, initiating graceful shutdown...`);
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        logger.error(`Error during ${signal} shutdown`, error);
        process.exit(1);
      }
    };

    // Only register once
    process.once('SIGTERM', () => handleShutdown('SIGTERM'));
    process.once('SIGINT', () => handleShutdown('SIGINT'));
  }

  /**
   * Signal all workers to flush their dirty states
   * Waits for all workers to complete flush with timeout
   *
   */
  private async signalWorkersToFlush(): Promise<void> {
    if (!this.workerPoolPort || !this.workerCommunicationPort) {
      logger.warn('Worker pool or communication port not available for flush');
      return;
    }

    const workerIds = this.workerPoolPort.getWorkerIds();
    if (workerIds.length === 0) {
      logger.debug('No workers to flush');
      return;
    }

    const timeoutMs = this.options.shutdownFlushTimeoutMs || 10000;
    logger.info(
      `Signaling ${workerIds.length} workers to flush dirty states (timeout: ${timeoutMs}ms)...`
    );

    // Track which workers have completed flush
    const flushPromises: Promise<void>[] = [];
    const flushCompleted = new Set<string>();

    // Create a promise for each worker that resolves when FLUSH_COMPLETE is received
    for (const workerId of workerIds) {
      const flushPromise = new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (!flushCompleted.has(workerId)) {
            logger.warn(
              `Worker ${workerId} flush timed out after ${timeoutMs}ms`
            );
            resolve(); // Don't reject, just continue
          }
        }, timeoutMs);

        // Send SHUTDOWN message to worker
        this.workerCommunicationPort!.sendToWorker(workerId, {
          id: `shutdown_${workerId}_${Date.now()}`,
          type: 'SHUTDOWN',
          data: { workerId },
        })
          .then((response) => {
            clearTimeout(timeout);
            flushCompleted.add(workerId);
            if (response.success) {
              logger.debug(`Worker ${workerId} flush completed`);
            } else {
              logger.warn(`Worker ${workerId} flush failed: ${response.error}`);
            }
            resolve();
          })
          .catch((error) => {
            clearTimeout(timeout);
            logger.warn(`Worker ${workerId} flush error: ${error.message}`);
            resolve(); // Don't reject, just continue
          });
      });

      flushPromises.push(flushPromise);
    }

    // Wait for all workers to complete flush (or timeout)
    await Promise.all(flushPromises);

    logger.info(
      `Worker flush complete: ${flushCompleted.size}/${workerIds.length} workers flushed successfully`
    );
  }
}
