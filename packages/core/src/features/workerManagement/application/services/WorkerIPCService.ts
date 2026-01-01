/**
 * WorkerIPCService - Application service for worker communication
 *
 * Implements the WorkerCommunicationPort interface and handles IPC
 * communication with worker threads.
 *
 */

import { injectable, inject } from 'inversify';
import { WORKER_MANAGEMENT_TYPES } from '../../../../shared/lib/di/bindings/features/workerManagement/types.js';
import {
  WorkerCommunicationPort,
  WorkerMessage,
  WorkerResponse,
  SendMessageOptions,
} from '../ports/in/WorkerCommunicationPort.js';
import { WorkerThreadPort } from '../ports/out/WorkerThreadPort.js';
import { createLogger } from '../../../../shared/lib/logger/logger.js';

const logger = createLogger('WorkerIPCService');

/** Default timeout for IPC requests */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Pending request tracking
 */
interface PendingRequest {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * WorkerIPCService - Handles IPC communication with worker threads
 */
@injectable()
export class WorkerIPCService implements WorkerCommunicationPort {
  /** Map of message ID to pending request */
  private pendingRequests: Map<string, PendingRequest> = new Map();

  /** Counter for generating unique message IDs */
  private messageCounter = 0;

  /** Set of worker IDs that have message handlers registered */
  private registeredHandlers: Set<string> = new Set();

  constructor(
    @inject(WORKER_MANAGEMENT_TYPES.WorkerThreadPort)
    private workerThreadPort: WorkerThreadPort
  ) {}

  /**
   * Send a message to a specific worker
   */
  async sendToWorker(
    workerId: string,
    message: WorkerMessage,
    options?: SendMessageOptions
  ): Promise<WorkerResponse> {
    const timeoutMs = options?.timeoutMs || DEFAULT_TIMEOUT_MS;

    // Ensure worker exists
    if (!this.workerThreadPort.hasWorker(workerId)) {
      throw new Error(`Worker ${workerId} not found`);
    }

    // Set up message handler if not already done
    this.ensureMessageHandler(workerId);

    return new Promise((resolve, reject) => {
      // Create timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // Store pending request
      this.pendingRequests.set(message.id, { resolve, reject, timeout });

      // Send message to worker
      this.workerThreadPort.postMessage(workerId, message);
    });
  }

  /**
   * Broadcast a message to all workers
   */
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

  /**
   * Send trades to a worker for processing
   */
  async sendTrades(
    workerId: string,
    symbol: string,
    trades: unknown[],
    config?: {
      tickValue?: number;
      exchange?: string;
      isNewSymbol?: boolean;
    }
  ): Promise<WorkerResponse> {
    const message: WorkerMessage = {
      id: this.generateMessageId(),
      type: 'PROCESS_TRADES_FULL',
      data: {
        symbol,
        trades,
        config,
        options: {
          batchId: `batch_${Date.now()}`,
        },
      },
    };

    return this.sendToWorker(workerId, message);
  }

  /**
   * Initialize a worker with configuration
   *
   * All deployments now use IPC-based persistence via socketPath.
   */
  async initializeWorker(
    workerId: string,
    config: {
      socketPath?: string;
      assignedSymbols: string[];
    }
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

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    this.messageCounter++;
    return `msg_${Date.now()}_${this.messageCounter}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  /**
   * Ensure message handler is set up for a worker
   * Only registers handler once per worker to avoid duplicate handlers
   */
  private ensureMessageHandler(workerId: string): void {
    // Only register handler once per worker
    if (this.registeredHandlers.has(workerId)) {
      logger.debug(`Handler already registered for ${workerId}`);
      return;
    }

    logger.info(`Registering IPC handler for worker ${workerId}`);

    // Set up message handler to resolve pending requests
    this.workerThreadPort.onMessage(workerId, (message) => {
      logger.debug(
        `IPC handler received message from ${workerId}: id=${
          (message as WorkerResponse).id
        }`
      );
      this.handleWorkerResponse(message as WorkerResponse);
    });

    this.registeredHandlers.add(workerId);
  }

  /**
   * Handle response from worker
   */
  private handleWorkerResponse(response: WorkerResponse): void {
    // Skip messages that don't have an id (like WORKER_READY)
    if (!response.id) {
      logger.debug('Skipping message without id');
      return;
    }

    logger.debug(
      `Looking for pending request: ${response.id}, pending count: ${this.pendingRequests.size}`
    );

    const pending = this.pendingRequests.get(response.id);

    if (pending) {
      logger.debug(`Found pending request for ${response.id}, resolving`);
      this.pendingRequests.delete(response.id);
      clearTimeout(pending.timeout);

      if (response.success) {
        pending.resolve(response);
      } else {
        pending.reject(new Error(response.error || 'Worker operation failed'));
      }
    } else {
      logger.debug(`No pending request for ${response.id}`);
    }
  }
}
