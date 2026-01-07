/**
 * WorkerManagementService - Unified service for worker management
 *
 * Implements WorkerManagementPort by merging:
 * - WorkerPoolService (lifecycle)
 * - WorkerIPCService (communication)
 * - TradeRouterService (routing logic)
 */

import { injectable, inject } from 'inversify';
import { WORKER_MANAGEMENT_TYPES } from '../../../../shared/lib/di/bindings/features/workerManagement/types.js';
import {
  WorkerManagementPort,
  WorkerPoolConfig,
  WorkerMessage,
  WorkerResponse,
  SendMessageOptions,
  RouteTradesResult,
  InitializeSymbolRoutingResult,
} from '../ports/in/WorkerManagementPort.js';
import { WorkerThreadPort } from '../ports/out/WorkerThreadPort.js';
import { WorkerThread } from '../../domain/entities/WorkerThread.js';
import { ConsistentHashRouter } from '../../domain/services/ConsistentHashRouter.js';
import { SpawnWorkerUseCase } from '../use-cases/SpawnWorker/index.js';
import {
  RouteTradesUseCase,
  RouteTradesRequest,
} from '../use-cases/RouteTrades/index.js';
import { AssignSymbolToWorkerUseCase } from '../use-cases/AssignSymbolToWorker/index.js';
import { RemoveSymbolFromWorkerUseCase } from '../use-cases/RemoveSymbolFromWorker/index.js';
import { createLogger } from '../../../../shared/lib/logger/logger.js';

const logger = createLogger('WorkerManagementService');

/** Default timeout for IPC requests */
const DEFAULT_TIMEOUT_MS = 30000;

/** Default timeout for waiting for workers to be ready */
const DEFAULT_READY_TIMEOUT = 10000;

/**
 * Startup configuration for worker spawn retry
 * Requirements: 4.2, 4.5
 */
const STARTUP_CONFIG = {
  /** Maximum spawn retry attempts during startup */
  maxSpawnRetries: 3,
  /** Initial delay between retries in ms */
  initialRetryDelayMs: 1000,
  /** Maximum delay between retries in ms */
  maxRetryDelayMs: 10000,
  /** Startup timeout in ms */
  startupTimeoutMs: 60000,
};

/**
 * Runtime crash recovery configuration
 * Requirements: 5.1, 5.2
 */
const RUNTIME_CRASH_CONFIG = {
  /** Maximum crashes allowed within the time window */
  maxCrashesInWindow: 3,
  /** Time window for crash counting in ms (5 minutes) */
  crashWindowMs: 5 * 60 * 1000,
  /** Initial delay between restart retries in ms */
  initialRetryDelayMs: 1000,
  /** Maximum delay between restart retries in ms */
  maxRetryDelayMs: 10000,
};

/**
 * Pending request tracking for IPC
 */
interface PendingRequest {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

@injectable()
export class WorkerManagementService implements WorkerManagementPort {
  // ============ Pool State ============
  private workers: Map<string, WorkerThread> = new Map();
  private startTime: Date = new Date();
  private config: WorkerPoolConfig | null = null;
  private pendingWorkers: Set<string> = new Set();
  private readyWorkers: Set<string> = new Set();
  private readyResolver: (() => void) | null = null;
  private readyRejecter: ((error: Error) => void) | null = null;
  private initStartTime: number = 0;

  // ============ IPC State ============
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private messageCounter = 0;
  private registeredHandlers: Set<string> = new Set();

  // ============ Crash Recovery State (Requirements 5.1, 5.2) ============
  /** Track crash timestamps per worker for rate limiting */
  private crashHistory: Map<string, number[]> = new Map();
  /** Workers that exceeded crash limit and should not be restarted */
  private permanentlyFailedWorkers: Set<string> = new Set();

  constructor(
    @inject(WORKER_MANAGEMENT_TYPES.WorkerThreadPort)
    private workerThreadPort: WorkerThreadPort,

    @inject(WORKER_MANAGEMENT_TYPES.SpawnWorkerUseCase)
    private spawnWorkerUseCase: SpawnWorkerUseCase,

    @inject(WORKER_MANAGEMENT_TYPES.ConsistentHashRouter)
    private router: ConsistentHashRouter,

    @inject(WORKER_MANAGEMENT_TYPES.RouteTradesUseCase)
    private routeTradesUseCase: RouteTradesUseCase,

    @inject(WORKER_MANAGEMENT_TYPES.AssignSymbolToWorkerUseCase)
    private assignSymbolUseCase: AssignSymbolToWorkerUseCase,

    @inject(WORKER_MANAGEMENT_TYPES.RemoveSymbolFromWorkerUseCase)
    private removeSymbolUseCase: RemoveSymbolFromWorkerUseCase
  ) {}

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  async initialize(config: WorkerPoolConfig): Promise<void> {
    logger.info(
      `Initializing worker pool with ${config.workerCount} workers...`
    );

    this.config = config;
    this.startTime = new Date();
    this.initStartTime = Date.now();

    // Clear any previous state
    this.pendingWorkers.clear();
    this.readyWorkers.clear();
    this.readyResolver = null;
    this.readyRejecter = null;
    this.crashHistory.clear();
    this.permanentlyFailedWorkers.clear();

    // Spawn all workers with retry - fail fast if any worker cannot be spawned
    const workerIds = Array.from(
      { length: config.workerCount },
      (_, i) => `worker_${i}`
    );

    const spawnPromises = workerIds.map(async (workerId) => {
      this.pendingWorkers.add(workerId);
      try {
        await this.spawnWorkerWithRetry(workerId);
      } catch (error) {
        // Re-throw to fail the entire startup (Requirement 4.3)
        throw new Error(`Startup failed: ${(error as Error).message}`);
      }
    });

    // Wait for all spawns - will throw if any fails
    await Promise.all(spawnPromises);

    logger.info(
      `Worker pool spawned ${this.workers.size}/${config.workerCount} workers, waiting for readiness signals`
    );

    // Wait for all workers to be ready with timeout (Requirement 4.4, 4.5)
    const timeoutMs = config.readyTimeout ?? STARTUP_CONFIG.startupTimeoutMs;
    await this.waitForAllWorkersReady(timeoutMs);

    const totalInitTime = Date.now() - this.initStartTime;
    logger.info(
      `Worker pool initialization complete: ${this.workers.size} workers ready in ${totalInitTime}ms`
    );
  }

  /**
   * Spawn a worker with retry logic and exponential backoff
   * Requirements: 4.1, 4.2, 4.3
   */
  private async spawnWorkerWithRetry(workerId: string): Promise<void> {
    if (!this.config) {
      throw new Error('Config not initialized');
    }

    let lastError: Error | undefined;

    for (
      let attempt = 1;
      attempt <= STARTUP_CONFIG.maxSpawnRetries;
      attempt++
    ) {
      try {
        const result = await this.spawnWorkerUseCase.execute({
          workerId,
          scriptPath: this.config.workerScript,
          socketPath: this.config.socketPath,
        });

        if (result.success && result.threadId !== undefined) {
          const worker = new WorkerThread(workerId, result.threadId);
          this.workers.set(workerId, worker);
          this.router.addWorker(workerId);
          this.setupWorkerHandlers(workerId);
          logger.info(
            `Worker ${workerId} spawned (attempt ${attempt}), waiting for WORKER_READY`
          );
          return;
        }

        lastError = new Error(result.error || 'Unknown spawn error');
      } catch (error) {
        lastError = error as Error;
      }

      if (attempt < STARTUP_CONFIG.maxSpawnRetries) {
        const delay = Math.min(
          STARTUP_CONFIG.initialRetryDelayMs * Math.pow(2, attempt - 1),
          STARTUP_CONFIG.maxRetryDelayMs
        );
        logger.warn(
          `Worker ${workerId} spawn failed (attempt ${attempt}/${STARTUP_CONFIG.maxSpawnRetries}), ` +
            `retrying in ${delay}ms: ${lastError?.message}`
        );
        await this.delay(delay);
      }
    }

    // All retries failed - throw to fail startup (Requirement 4.3)
    this.pendingWorkers.delete(workerId);
    throw new Error(
      `Failed to spawn worker ${workerId} after ${STARTUP_CONFIG.maxSpawnRetries} attempts: ${lastError?.message}`
    );
  }

  async shutdown(): Promise<void> {
    logger.info(`Shutting down worker pool (${this.workers.size} workers)...`);

    const terminatePromises: Promise<void>[] = [];

    for (const [workerId, worker] of this.workers) {
      worker.markTerminated();

      const terminatePromise = this.workerThreadPort
        .terminate(workerId)
        .then(() => {
          logger.info(`Worker ${workerId} terminated`);
        })
        .catch((error) => {
          logger.error(
            `Error terminating worker ${workerId}: ${error.message}`
          );
        });

      terminatePromises.push(terminatePromise);
    }

    await Promise.all(terminatePromises);
    this.workers.clear();
    logger.info('Worker pool shutdown complete');
  }

  // ============================================================================
  // Communication Methods
  // ============================================================================

  async sendToWorker(
    workerId: string,
    message: WorkerMessage,
    options?: SendMessageOptions
  ): Promise<WorkerResponse> {
    const timeoutMs = options?.timeoutMs || DEFAULT_TIMEOUT_MS;

    if (!this.workerThreadPort.hasWorker(workerId)) {
      throw new Error(`Worker ${workerId} not found`);
    }

    this.ensureMessageHandler(workerId);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(message.id, { resolve, reject, timeout });
      this.workerThreadPort.postMessage(workerId, message);
    });
  }

  async broadcastToAll(
    message: Omit<WorkerMessage, 'id'>,
    options?: SendMessageOptions
  ): Promise<WorkerResponse[]> {
    const workerIds = this.workerThreadPort.getAllWorkerIds();
    const responses: Promise<WorkerResponse>[] = [];

    for (const workerId of workerIds) {
      const fullMessage: WorkerMessage = {
        ...message,
        id: this.generateMessageId(),
      };
      responses.push(this.sendToWorker(workerId, fullMessage, options));
    }

    return Promise.all(responses);
  }

  // ============================================================================
  // Trade Routing Methods
  // ============================================================================

  async routeTrades(
    symbol: string,
    trades: unknown[],
    options?: { priority?: 'urgent' | 'normal'; batchId?: string }
  ): Promise<RouteTradesResult> {
    const request: RouteTradesRequest = {
      symbol,
      trades,
      priority: options?.priority,
      batchId: options?.batchId,
      timestamp: new Date(),
    };

    try {
      const result = await this.routeTradesUseCase.execute(request);
      return result as RouteTradesResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown routing error';
      logger.error(`routeTrades failed: ${errorMessage}`);
      return {
        success: false,
        workerId: '',
        processingTime: 0,
        symbol,
        tradeCount: trades.length,
        error: errorMessage,
      };
    }
  }

  async initializeSymbolRouting(
    symbols: string[],
    socketPath: string
  ): Promise<InitializeSymbolRoutingResult> {
    // Step 1: Assign symbols to workers
    const assignResults = await Promise.allSettled(
      symbols.map((symbol) => this.assignSymbolToWorker(symbol))
    );

    const failedSymbols = assignResults
      .map((result, index) =>
        result.status === 'rejected' ? symbols[index] : null
      )
      .filter((symbol): symbol is string => symbol !== null);

    // Step 2: Pre-compute symbol assignments using ConsistentHashRouter
    const workerIds = Array.from(this.workers.keys());
    const workerSymbolMap = new Map<string, string[]>();

    for (const workerId of workerIds) {
      workerSymbolMap.set(workerId, []);
    }

    for (const symbol of symbols) {
      try {
        const routingResult = this.router.getWorkerForSymbol(symbol);
        const workerSymbols = workerSymbolMap.get(routingResult.workerId);
        if (workerSymbols) {
          workerSymbols.push(symbol);
        }
      } catch (error) {
        logger.warn(
          `Failed to route symbol ${symbol}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    // Step 3: Send WORKER_INIT to each worker
    const workerInitResults = new Map<
      string,
      { success: boolean; symbolCount: number }
    >();

    for (const [workerId, assignedSymbols] of workerSymbolMap) {
      try {
        await this.initializeWorker(workerId, { socketPath, assignedSymbols });
        workerInitResults.set(workerId, {
          success: true,
          symbolCount: assignedSymbols.length,
        });
        logger.info(
          `Worker ${workerId} initialized with ${
            assignedSymbols.length
          } symbols: [${assignedSymbols.slice(0, 3).join(', ')}${
            assignedSymbols.length > 3 ? '...' : ''
          }]`
        );
      } catch (error) {
        workerInitResults.set(workerId, { success: false, symbolCount: 0 });
        logger.error(
          `Failed to initialize worker ${workerId}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    return {
      success: failedSymbols.length === 0,
      assignedSymbols: symbols.length - failedSymbols.length,
      failedSymbols,
      workerInitResults,
    };
  }

  // ============================================================================
  // Symbol Management Methods
  // ============================================================================

  async assignSymbolToWorker(symbol: string, workerId?: string): Promise<void> {
    try {
      const result = await this.assignSymbolUseCase.execute({
        symbol,
        workerId,
        force: false,
        workers: this.workers,
      });

      if (!result.success) {
        throw new Error(result.message || 'Assignment failed');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to assign ${symbol}: ${errorMessage}`);
      throw error;
    }
  }

  async removeSymbolFromWorker(symbol: string): Promise<void> {
    try {
      const result = await this.removeSymbolUseCase.execute({
        symbol,
        force: false,
        workers: this.workers,
      });

      if (!result.success) {
        throw new Error(result.message || 'Removal failed');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to remove ${symbol}: ${errorMessage}`);
      throw error;
    }
  }

  // ============================================================================
  // Internal Access Methods (for WorkerStatusService)
  // ============================================================================

  getWorker(workerId: string): WorkerThread | undefined {
    return this.workers.get(workerId);
  }

  hasWorker(workerId: string): boolean {
    return this.workers.has(workerId);
  }

  /**
   * Get internal state for WorkerStatusService
   */
  getInternalState(): {
    workers: Map<string, WorkerThread>;
    startTime: Date;
    readyWorkers: Set<string>;
    pendingWorkers: Set<string>;
  } {
    return {
      workers: this.workers,
      startTime: this.startTime,
      readyWorkers: this.readyWorkers,
      pendingWorkers: this.pendingWorkers,
    };
  }

  // ============================================================================
  // Private Methods - Worker Lifecycle
  // ============================================================================

  private setupWorkerHandlers(workerId: string): void {
    this.workerThreadPort.onMessage(workerId, (message) => {
      this.handleWorkerMessage(workerId, message);
    });

    this.workerThreadPort.onError(workerId, (error) => {
      this.handleWorkerError(workerId, error);
    });

    this.workerThreadPort.onExit(workerId, (exitCode) => {
      this.handleWorkerExit(workerId, exitCode);
    });
  }

  private handleWorkerMessage(workerId: string, message: unknown): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.recordHeartbeat();
    }

    if (this.isWorkerReadyMessage(message)) {
      this.handleWorkerReadyMessage(workerId, message);
    }

    // Handle IPC responses
    this.handleWorkerResponse(message as WorkerResponse);
  }

  private isWorkerReadyMessage(
    message: unknown
  ): message is { type: 'WORKER_READY'; workerId: string; timestamp: number } {
    return (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      (message as { type: string }).type === 'WORKER_READY' &&
      'workerId' in message &&
      'timestamp' in message
    );
  }

  private handleWorkerReadyMessage(
    workerId: string,
    message: { type: 'WORKER_READY'; workerId: string; timestamp: number }
  ): void {
    const worker = this.workers.get(workerId);
    if (!worker) {
      logger.warn(`Received WORKER_READY from unknown worker: ${workerId}`);
      return;
    }

    this.pendingWorkers.delete(workerId);
    this.readyWorkers.add(workerId);
    worker.markWorkerReady(message.timestamp);

    logger.info(
      `Worker ${workerId} is ready (${this.readyWorkers.size}/${this.workers.size} workers ready)`
    );

    if (this.areAllWorkersReady() && this.readyResolver) {
      this.readyResolver();
    }
  }

  private handleWorkerError(workerId: string, error: Error): void {
    logger.error(`Worker ${workerId} error: ${error.message}`);

    const worker = this.workers.get(workerId);
    if (worker) {
      worker.recordError(error.message);
      worker.markUnhealthy(error.message);
    }
  }

  private handleWorkerExit(workerId: string, exitCode: number): void {
    const worker = this.workers.get(workerId);

    // PRESERVE symbols BEFORE markTerminated() - Critical for crash recovery
    const assignedSymbols = worker?.assignedSymbols ?? [];

    // Log crash event with details (Requirement 3.1)
    logger.warn(
      `Worker ${workerId} exited with code ${exitCode}, ` +
        `symbols: ${assignedSymbols.length} [${assignedSymbols
          .slice(0, 5)
          .join(', ')}${assignedSymbols.length > 5 ? '...' : ''}]`
    );

    if (worker) {
      worker.markTerminated();
    }

    this.router.removeWorker(workerId);

    // Restart with preserved symbols if non-zero exit (crash)
    if (exitCode !== 0 && this.config) {
      // Check crash limit before attempting restart (Requirement 5.2)
      if (this.shouldRetryRestart(workerId)) {
        this.recordCrash(workerId);
        logger.info(
          `Attempting to restart worker ${workerId} with ${assignedSymbols.length} symbols...`
        );
        this.restartWorkerWithRetry(workerId, assignedSymbols);
      } else {
        logger.error(
          `Worker ${workerId} exceeded crash limit (${
            RUNTIME_CRASH_CONFIG.maxCrashesInWindow
          } crashes in ${RUNTIME_CRASH_CONFIG.crashWindowMs / 60000} min), ` +
            `marking as permanently failed. Affected symbols: ${assignedSymbols.length}`
        );
        this.permanentlyFailedWorkers.add(workerId);
        // Trades will continue to be buffered for this worker's symbols (if buffering is enabled)
      }
    }
  }

  /**
   * Check if we should retry restarting a worker based on crash history
   * Requirements: 5.2
   */
  private shouldRetryRestart(workerId: string): boolean {
    if (this.permanentlyFailedWorkers.has(workerId)) {
      return false;
    }

    const now = Date.now();
    const crashes = this.crashHistory.get(workerId) ?? [];

    // Filter crashes within the time window
    const recentCrashes = crashes.filter(
      (ts) => now - ts < RUNTIME_CRASH_CONFIG.crashWindowMs
    );

    return recentCrashes.length < RUNTIME_CRASH_CONFIG.maxCrashesInWindow;
  }

  /**
   * Record a crash timestamp for rate limiting
   */
  private recordCrash(workerId: string): void {
    const crashes = this.crashHistory.get(workerId) ?? [];
    crashes.push(Date.now());

    // Keep only recent crashes to avoid memory leak
    const now = Date.now();
    const recentCrashes = crashes.filter(
      (ts) => now - ts < RUNTIME_CRASH_CONFIG.crashWindowMs
    );

    this.crashHistory.set(workerId, recentCrashes);
  }

  /**
   * Restart worker with retry logic and exponential backoff
   * Requirements: 5.1
   */
  private async restartWorkerWithRetry(
    workerId: string,
    assignedSymbols: string[]
  ): Promise<void> {
    if (!this.config) return;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await this.spawnWorkerUseCase.execute({
        workerId,
        scriptPath: this.config.workerScript,
        socketPath: this.config.socketPath,
      });

      if (result.success && result.threadId !== undefined) {
        // Clean up old state
        this.workers.delete(workerId);
        this.readyWorkers.delete(workerId);
        this.pendingWorkers.delete(workerId);
        this.pendingWorkers.add(workerId);

        // Create new WorkerThread WITH preserved symbols
        const worker = new WorkerThread(
          workerId,
          result.threadId,
          assignedSymbols
        );
        this.workers.set(workerId, worker);
        this.router.addWorker(workerId);
        this.setupWorkerHandlers(workerId);

        // Send WORKER_INIT with symbols
        try {
          await this.initializeWorker(workerId, {
            socketPath: this.config.socketPath,
            assignedSymbols,
          });

          logger.info(
            `Worker ${workerId} restarted (attempt ${attempt}), ` +
              `${assignedSymbols.length} symbols restored, waiting for WORKER_READY`
          );
          return;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          logger.warn(
            `Worker ${workerId} spawn succeeded but init failed (attempt ${attempt}): ${lastError.message}`
          );
        }
      } else {
        lastError = new Error(result.error || 'Unknown spawn error');
      }

      if (attempt < 3) {
        const delay = Math.min(
          RUNTIME_CRASH_CONFIG.initialRetryDelayMs * Math.pow(2, attempt - 1),
          RUNTIME_CRASH_CONFIG.maxRetryDelayMs
        );
        logger.warn(
          `Worker ${workerId} restart failed (attempt ${attempt}/3), retrying in ${delay}ms...`
        );
        await this.delay(delay);
      }
    }

    logger.error(
      `Failed to restart worker ${workerId} after 3 attempts: ${lastError?.message}, ` +
        `affected symbols: ${assignedSymbols.length}`
    );
  }

  private areAllWorkersReady(): boolean {
    return this.pendingWorkers.size === 0 && this.readyWorkers.size > 0;
  }

  private waitForAllWorkersReady(timeout?: number): Promise<void> {
    const timeoutMs =
      timeout ?? this.config?.readyTimeout ?? DEFAULT_READY_TIMEOUT;

    if (this.areAllWorkersReady()) {
      const initTime = Date.now() - this.initStartTime;
      logger.info(`All workers ready (took ${initTime}ms)`);
      return Promise.resolve();
    }

    if (this.pendingWorkers.size === 0 && this.readyWorkers.size === 0) {
      return Promise.reject(new Error('No workers to wait for'));
    }

    return new Promise<void>((resolve, reject) => {
      this.readyResolver = () => {
        const initTime = Date.now() - this.initStartTime;
        logger.info(`All workers ready (took ${initTime}ms)`);
        resolve();
      };
      this.readyRejecter = reject;

      const timeoutId = setTimeout(() => {
        const pendingList = Array.from(this.pendingWorkers).join(', ');
        const error = new Error(
          `Timeout waiting for workers to be ready after ${timeoutMs}ms. ` +
            `Pending workers: [${pendingList}] (${this.pendingWorkers.size} of ${this.workers.size} workers not ready)`
        );

        logger.error(error.message);
        this.readyResolver = null;
        this.readyRejecter = null;
        reject(error);
      }, timeoutMs);

      const originalResolver = this.readyResolver;
      this.readyResolver = () => {
        clearTimeout(timeoutId);
        this.readyResolver = null;
        this.readyRejecter = null;
        originalResolver();
      };
    });
  }

  // ============================================================================
  // Private Methods - IPC
  // ============================================================================

  private generateMessageId(): string {
    this.messageCounter++;
    return `msg_${Date.now()}_${this.messageCounter}_${Math.random()
      .toString(36)
      .slice(2, 11)}`;
  }

  private ensureMessageHandler(workerId: string): void {
    if (this.registeredHandlers.has(workerId)) {
      return;
    }

    logger.debug(`Registering IPC handler for worker ${workerId}`);
    this.workerThreadPort.onMessage(workerId, (message) => {
      this.handleWorkerResponse(message as WorkerResponse);
    });
    this.registeredHandlers.add(workerId);
  }

  private handleWorkerResponse(response: WorkerResponse): void {
    if (!response.id) {
      return;
    }

    const pending = this.pendingRequests.get(response.id);

    if (pending) {
      this.pendingRequests.delete(response.id);
      clearTimeout(pending.timeout);

      if (response.success) {
        pending.resolve(response);
      } else {
        pending.reject(new Error(response.error || 'Worker operation failed'));
      }
    }
  }

  private async initializeWorker(
    workerId: string,
    config: { socketPath?: string; assignedSymbols: string[] }
  ): Promise<void> {
    const message: WorkerMessage = {
      id: this.generateMessageId(),
      type: 'WORKER_INIT',
      data: {
        workerId,
        socketPath: config.socketPath,
        assignedSymbols: config.assignedSymbols,
      },
    };

    const response = await this.sendToWorker(workerId, message);

    if (!response.success) {
      throw new Error(
        `Failed to initialize worker ${workerId}: ${response.error}`
      );
    }

    logger.info(
      `Worker ${workerId} initialized with ${config.assignedSymbols.length} symbols`
    );
  }

  /**
   * Helper method for async delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
