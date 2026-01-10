/**
 * IPCGapPersistenceAdapter
 *
 * Implements GapPersistencePort using Unix Socket IPC to communicate
 * with the persistence service. Handles request/response pattern with
 * retry logic and exponential backoff.
 *
 */

import { injectable, inject } from 'inversify';
import * as net from 'net';
import { randomUUID } from 'crypto';
import type { GapPersistencePort } from '../../application/ports/out/GapPersistencePort.js';
import type {
  GapMessage,
  GapResponse,
  GapSavePayload,
  GapSaveBatchPayload,
  GapLoadPayload,
  GapMarkSyncedPayload,
  GapRecordDTO,
  GapRecordInputDTO,
  GapLoadOptionsDTO,
} from '@flowtrace/ipc';
import { createLogger } from '../../../../shared/lib/logger/logger.js';

const logger = createLogger('IPCGapPersistenceAdapter');

/**
 * Configuration for IPCGapPersistenceAdapter
 */
export interface IPCGapPersistenceConfig {
  socketPath: string;
  connectTimeout?: number;
  requestTimeout?: number;
  maxRetries?: number;
  baseRetryDelay?: number;
  maxRetryDelay?: number;
  // Queue configuration
  maxQueueSize?: number;
  maxRetryQueueSize?: number;
  batchSize?: number;
  flushIntervalMs?: number;
  retryIntervalMs?: number;
  batchMaxRetries?: number;
  batchRetryDelays?: number[];
  flushTimeoutMs?: number;
}

/**
 * Queue metrics for monitoring
 */
export interface GapQueueMetrics {
  queueSize: number;
  retryQueueSize: number;
  processedCount: number;
  droppedCount: number;
  failedCount: number;
}

/**
 * Pending request tracking
 */
interface PendingRequest {
  resolve: (response: GapResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * IPCGapPersistenceAdapter
 * Implements GapPersistencePort with Unix Socket IPC and request/response pattern
 */
@injectable()
export class IPCGapPersistenceAdapter implements GapPersistencePort {
  private socket: net.Socket | null = null;
  private connected: boolean = false;
  private readonly socketPath: string;
  private readonly connectTimeout: number;
  private readonly requestTimeout: number;
  private readonly maxRetries: number;
  private readonly baseRetryDelay: number;
  private readonly maxRetryDelay: number;

  // Pending requests map (messageId -> resolver)
  private pendingRequests: Map<string, PendingRequest> = new Map();

  // Buffer for incoming data
  private receiveBuffer: Buffer = Buffer.alloc(0);

  // Queue for pending gap records
  private pendingGaps: GapRecordInputDTO[] = [];
  private retryQueue: GapRecordInputDTO[] = [];
  private readonly maxQueueSize: number;
  private readonly maxRetryQueueSize: number;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly retryIntervalMs: number;
  private readonly batchMaxRetries: number;
  private readonly batchRetryDelays: number[];
  private readonly flushTimeoutMs: number;

  // Processing state
  private isProcessing: boolean = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;

  // Metrics
  private processedCount: number = 0;
  private droppedCount: number = 0;
  private failedCount: number = 0;

  constructor(
    @inject('IPC_GAP_PERSISTENCE_CONFIG')
    config: IPCGapPersistenceConfig
  ) {
    this.socketPath = config.socketPath;
    this.connectTimeout = config.connectTimeout ?? 5000;
    this.requestTimeout = config.requestTimeout ?? 10000;
    this.maxRetries = config.maxRetries ?? 3;
    this.baseRetryDelay = config.baseRetryDelay ?? 500;
    this.maxRetryDelay = config.maxRetryDelay ?? 4000;

    // Queue configuration
    this.maxQueueSize = config.maxQueueSize ?? 1000;
    this.maxRetryQueueSize = config.maxRetryQueueSize ?? 500;
    this.batchSize = config.batchSize ?? 10;
    this.flushIntervalMs = config.flushIntervalMs ?? 1000;
    this.retryIntervalMs = config.retryIntervalMs ?? 5000;
    this.batchMaxRetries = config.batchMaxRetries ?? 3;
    this.batchRetryDelays = config.batchRetryDelays ?? [100, 200, 400];
    this.flushTimeoutMs = config.flushTimeoutMs ?? 10000;
  }

  /**
   * Connect to persistence service via Unix Socket
   */
  async connect(): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        await this.attemptConnect();
        logger.info('Connected to persistence service for gap records', {
          socketPath: this.socketPath,
          attempt: attempt + 1,
        });
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const delay = Math.min(
          this.baseRetryDelay * Math.pow(2, attempt),
          this.maxRetryDelay
        );

        logger.warn('Gap persistence connection attempt failed, retrying', {
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          delayMs: delay,
          error: lastError.message,
        });

        if (attempt < this.maxRetries - 1) {
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `Failed to connect to persistence service for gap records after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Attempt a single connection
   */
  private async attemptConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error(`Connection timeout after ${this.connectTimeout}ms`));
      }, this.connectTimeout);

      this.socket = net.createConnection(this.socketPath);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.connected = true;
        this.setupDataHandler();
        resolve();
      });

      this.socket.on('error', (error) => {
        clearTimeout(timeout);
        this.connected = false;
        reject(error);
      });

      this.socket.on('close', () => {
        this.connected = false;
        this.rejectAllPending(new Error('Connection closed'));
      });
    });
  }

  /**
   * Setup data handler for receiving responses
   */
  private setupDataHandler(): void {
    if (!this.socket) return;

    this.socket.on('data', (data) => {
      this.receiveBuffer = Buffer.concat([this.receiveBuffer, data]);
      this.processReceiveBuffer();
    });
  }

  /**
   * Process received data buffer for complete messages
   */
  private processReceiveBuffer(): void {
    while (this.receiveBuffer.length >= 4) {
      const messageLength = this.receiveBuffer.readUInt32BE(0);

      if (this.receiveBuffer.length >= 4 + messageLength) {
        const messageBuffer = this.receiveBuffer.subarray(4, 4 + messageLength);
        this.receiveBuffer = this.receiveBuffer.subarray(4 + messageLength);

        try {
          const response = JSON.parse(messageBuffer.toString());
          this.handleResponse(response);
        } catch (error) {
          logger.error('Failed to parse gap response', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      } else {
        break;
      }
    }
  }

  /**
   * Handle a received response
   */
  private handleResponse(response: unknown): void {
    if (
      typeof response !== 'object' ||
      response === null ||
      !('id' in response)
    ) {
      logger.warn('Received gap response without id', { response });
      return;
    }

    const messageId = (response as { id: string }).id;
    const pending = this.pendingRequests.get(messageId);

    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(messageId);
      const gapResponse = response as unknown as GapResponse;
      pending.resolve(gapResponse);
    } else {
      // Late response - request already timed out and was removed
      logger.debug('Received late response for completed gap request', {
        messageId,
      });
    }
  }

  /**
   * Reject all pending requests
   */
  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  /**
   * Disconnect from persistence service
   */
  async disconnect(): Promise<void> {
    // Flush all pending gaps before disconnecting
    await this.flushAll();

    this.rejectAllPending(new Error('Disconnecting'));

    if (this.socket) {
      this.socket.end();
      this.socket = null;
      this.connected = false;
    }
  }

  /**
   * Check if connected to persistence service
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Send a request and wait for response
   */
  private async sendRequest<T extends GapResponse>(
    message: GapMessage
  ): Promise<T> {
    if (!this.connected || !this.socket) {
      throw new Error('Not connected to persistence service');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new Error(`Request timeout after ${this.requestTimeout}ms`));
      }, this.requestTimeout);

      this.pendingRequests.set(message.id, {
        resolve: resolve as (response: GapResponse) => void,
        reject,
        timeout,
      });

      const buffer = this.serialize(message);
      this.socket!.write(buffer, (error) => {
        if (error) {
          clearTimeout(timeout);
          this.pendingRequests.delete(message.id);
          reject(error);
        }
      });
    });
  }

  /**
   * Serialize message with length prefix
   */
  private serialize(message: unknown): Buffer {
    const json = JSON.stringify(message);
    const length = Buffer.byteLength(json);
    const header = Buffer.alloc(4);
    header.writeUInt32BE(length, 0);
    return Buffer.concat([header, Buffer.from(json)]);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a gap message
   */
  private createMessage(
    payload:
      | GapSavePayload
      | GapSaveBatchPayload
      | GapLoadPayload
      | GapMarkSyncedPayload
  ): GapMessage {
    return {
      id: randomUUID(),
      type: 'gap',
      payload,
      timestamp: Date.now(),
    };
  }

  /**
   * Save a gap record (non-blocking, adds to queue)
   * Returns immediately without waiting for IPC response
   */
  async saveGap(gap: GapRecordInputDTO): Promise<void> {
    // Check queue capacity - drop oldest if full
    if (this.pendingGaps.length >= this.maxQueueSize) {
      this.droppedCount++;
      this.pendingGaps.shift(); // Drop oldest
      logger.warn('Gap queue full, dropping oldest record', {
        queueSize: this.pendingGaps.length,
        droppedCount: this.droppedCount,
        symbol: gap.symbol,
      });
    }

    // Add to queue
    this.pendingGaps.push(gap);

    // Log if queue is getting large (every 100 records after 100)
    if (this.pendingGaps.length > 100 && this.pendingGaps.length % 100 === 0) {
      logger.warn('Gap queue size warning', {
        queueSize: this.pendingGaps.length,
      });
    }

    // Trigger processing (non-blocking)
    this.scheduleFlush();
  }

  /**
   * Schedule flush if not already scheduled
   */
  private scheduleFlush(): void {
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.processQueue().catch((err) => {
        logger.error('Gap queue processing failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, this.flushIntervalMs);
  }

  /**
   * Process queue in batches
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.pendingGaps.length === 0) return;

    this.isProcessing = true;

    try {
      while (this.pendingGaps.length > 0) {
        // Take a batch
        const batch = this.pendingGaps.splice(0, this.batchSize);

        const success = await this.saveGapBatchWithRetry(batch);
        if (success) {
          this.processedCount += batch.length;
        } else {
          // Move failed batch to retry queue
          this.moveToRetryQueue(batch);
        }
      }

      logger.debug('Gap queue flush completed', {
        processedCount: this.processedCount,
        retryQueueSize: this.retryQueue.length,
      });
    } finally {
      this.isProcessing = false;

      // Schedule another flush if more items arrived during processing
      if (this.pendingGaps.length > 0) {
        this.scheduleFlush();
      }
    }
  }

  /**
   * Save batch of gaps with retry logic
   * Returns true if successful, false if all retries failed
   */
  private async saveGapBatchWithRetry(
    gaps: GapRecordInputDTO[]
  ): Promise<boolean> {
    for (let attempt = 0; attempt <= this.batchMaxRetries; attempt++) {
      try {
        await this.sendGapBatch(gaps);
        return true;
      } catch (error) {
        if (attempt < this.batchMaxRetries) {
          const delay = this.batchRetryDelays[attempt] ?? 400;
          logger.warn('Gap batch save failed, retrying', {
            attempt: attempt + 1,
            maxRetries: this.batchMaxRetries,
            delayMs: delay,
            batchSize: gaps.length,
            error: error instanceof Error ? error.message : String(error),
          });
          await this.sleep(delay);
        } else {
          logger.error(
            'Gap batch save failed after all retries, moving to retry queue',
            {
              batchSize: gaps.length,
              error: error instanceof Error ? error.message : String(error),
            }
          );
          return false;
        }
      }
    }
    return false;
  }

  /**
   * Send batch of gaps via IPC
   */
  private async sendGapBatch(gaps: GapRecordInputDTO[]): Promise<void> {
    const message = this.createMessage({
      action: 'gap_save_batch',
      gaps,
    });

    const response = await this.sendRequestWithRetry(message);

    if (!response.success) {
      throw new Error(`Failed to save gap batch: ${response.error}`);
    }
  }

  /**
   * Move failed batch to retry queue
   */
  private moveToRetryQueue(gaps: GapRecordInputDTO[]): void {
    // Check retry queue capacity
    while (this.retryQueue.length + gaps.length > this.maxRetryQueueSize) {
      const dropped = this.retryQueue.shift();
      if (dropped) {
        this.droppedCount++;
        logger.error('Retry queue overflow, dropping gap record', {
          symbol: dropped.symbol,
          retryQueueSize: this.retryQueue.length,
        });
      }
    }

    this.retryQueue.push(...gaps);
    this.failedCount += gaps.length;
    this.scheduleRetryQueueProcessing();
  }

  /**
   * Schedule retry queue processing if not already scheduled
   */
  private scheduleRetryQueueProcessing(): void {
    if (this.retryTimer) return;

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.processRetryQueue().catch((err) => {
        logger.error('Retry queue processing failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, this.retryIntervalMs);
  }

  /**
   * Process retry queue
   */
  private async processRetryQueue(): Promise<void> {
    if (this.retryQueue.length === 0) return;

    logger.info('Processing retry queue', {
      retryQueueSize: this.retryQueue.length,
    });

    while (this.retryQueue.length > 0) {
      const batch = this.retryQueue.splice(0, this.batchSize);

      const success = await this.saveGapBatchWithRetry(batch);
      if (success) {
        this.processedCount += batch.length;
        this.failedCount -= batch.length; // Recovered from failed
        logger.info('Retry batch succeeded', {
          batchSize: batch.length,
          remainingRetry: this.retryQueue.length,
        });
      } else {
        // Put back at end of retry queue for next cycle
        this.retryQueue.push(...batch);
        break; // Stop processing this cycle, try again later
      }
    }

    // Schedule next retry cycle if still have items
    if (this.retryQueue.length > 0) {
      this.scheduleRetryQueueProcessing();
    }
  }

  /**
   * Flush all pending gaps (for graceful shutdown)
   */
  async flushAll(timeoutMs?: number): Promise<void> {
    const timeout = timeoutMs ?? this.flushTimeoutMs;
    const startTime = Date.now();

    // Cancel scheduled timers
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    // Wait for current processing to complete (with timeout)
    while (this.isProcessing && Date.now() - startTime < timeout) {
      await this.sleep(50);
    }

    // Process remaining gaps in main queue
    while (this.pendingGaps.length > 0 && Date.now() - startTime < timeout) {
      const batch = this.pendingGaps.splice(0, this.batchSize);
      const success = await this.saveGapBatchWithRetry(batch);
      if (success) {
        this.processedCount += batch.length;
      }
    }

    // Process retry queue
    while (this.retryQueue.length > 0 && Date.now() - startTime < timeout) {
      const batch = this.retryQueue.splice(0, this.batchSize);
      const success = await this.saveGapBatchWithRetry(batch);
      if (success) {
        this.processedCount += batch.length;
        this.failedCount -= batch.length;
      }
    }

    const remainingCount = this.pendingGaps.length + this.retryQueue.length;
    if (remainingCount > 0) {
      logger.warn('Gap flush timeout, remaining gaps will be lost', {
        remainingPending: this.pendingGaps.length,
        remainingRetry: this.retryQueue.length,
      });
    }

    logger.info('Gap queue flushed', {
      processedCount: this.processedCount,
      droppedCount: this.droppedCount,
      failedCount: this.failedCount,
      remainingCount,
    });
  }

  /**
   * Get queue metrics for monitoring
   */
  getMetrics(): GapQueueMetrics {
    return {
      queueSize: this.pendingGaps.length,
      retryQueueSize: this.retryQueue.length,
      processedCount: this.processedCount,
      droppedCount: this.droppedCount,
      failedCount: this.failedCount,
    };
  }

  /**
   * Load gap records with optional filtering
   */
  async loadGaps(options?: GapLoadOptionsDTO): Promise<GapRecordDTO[]> {
    const message = this.createMessage({
      action: 'gap_load',
      symbol: options?.symbol,
      syncedOnly: options?.syncedOnly,
    });

    const response = await this.sendRequestWithRetry(message);

    if (!response.success) {
      throw new Error(`Failed to load gap records: ${response.error}`);
    }

    return response.data?.gaps ?? [];
  }

  /**
   * Mark gap records as synced
   */
  async markGapsSynced(gapIds: number[]): Promise<void> {
    if (gapIds.length === 0) {
      return;
    }

    const message = this.createMessage({
      action: 'gap_mark_synced',
      gapIds,
    });

    const response = await this.sendRequestWithRetry(message);

    if (!response.success) {
      throw new Error(`Failed to mark gaps as synced: ${response.error}`);
    }

    logger.debug('Gap records marked as synced', { count: gapIds.length });
  }

  /**
   * Send request with retry logic
   * Note: Gap persistence is non-critical, so we use fewer retries
   */
  private async sendRequestWithRetry(
    message: GapMessage
  ): Promise<GapResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Reconnect if not connected
        if (!this.connected) {
          await this.connect();
        }

        return await this.sendRequest(message);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const delay = Math.min(
          this.baseRetryDelay * Math.pow(2, attempt),
          this.maxRetryDelay
        );

        logger.warn('Gap request failed, retrying', {
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          delayMs: delay,
          action: (message.payload as { action: string }).action,
          error: lastError.message,
        });

        // Mark as disconnected if it's a connection error
        if (
          lastError.message.includes('Not connected') ||
          lastError.message.includes('Connection')
        ) {
          this.connected = false;
        }

        if (attempt < this.maxRetries - 1) {
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `Gap request failed after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }
}
