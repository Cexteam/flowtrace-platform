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

    // Spawn workers
    const spawnPromises: Promise<void>[] = [];

    for (let i = 0; i < config.workerCount; i++) {
      const workerId = `worker_${i}`;
      this.pendingWorkers.add(workerId);

      const spawnPromise = this.spawnWorkerUseCase
        .execute({
          workerId,
          scriptPath: config.workerScript,
          socketPath: config.socketPath,
        })
        .then((result) => {
          if (result.success && result.threadId !== undefined) {
            const worker = new WorkerThread(workerId, result.threadId);
            this.workers.set(workerId, worker);
            this.router.addWorker(workerId);
            this.setupWorkerHandlers(workerId);
            logger.info(`Worker ${workerId} spawned, waiting for WORKER_READY`);
          } else {
            this.pendingWorkers.delete(workerId);
            logger.error(`Failed to spawn worker ${workerId}: ${result.error}`);
          }
        });

      spawnPromises.push(spawnPromise);
    }

    await Promise.all(spawnPromises);

    logger.info(
      `Worker pool spawned ${this.workers.size}/${config.workerCount} workers, waiting for readiness signals`
    );

    await this.waitForAllWorkersReady(config.readyTimeout);

    const totalInitTime = Date.now() - this.initStartTime;
    logger.info(
      `Worker pool initialization complete: ${this.workers.size} workers ready in ${totalInitTime}ms`
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
    logger.warn(`Worker ${workerId} exited with code ${exitCode}`);

    const worker = this.workers.get(workerId);
    if (worker) {
      worker.markTerminated();
    }

    this.router.removeWorker(workerId);

    if (exitCode !== 0 && this.config) {
      logger.info(`Attempting to restart worker ${workerId}...`);
      this.restartWorker(workerId);
    }
  }

  private async restartWorker(workerId: string): Promise<void> {
    if (!this.config) return;

    this.workers.delete(workerId);
    this.readyWorkers.delete(workerId);
    this.pendingWorkers.delete(workerId);
    this.pendingWorkers.add(workerId);

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
      logger.info(`Worker ${workerId} restarted, waiting for WORKER_READY`);
    } else {
      this.pendingWorkers.delete(workerId);
      logger.error(`Failed to restart worker ${workerId}: ${result.error}`);
    }
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
}
