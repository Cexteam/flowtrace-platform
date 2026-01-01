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

  constructor(
    @inject('IPC_GAP_PERSISTENCE_CONFIG')
    config: IPCGapPersistenceConfig
  ) {
    this.socketPath = config.socketPath;
    this.connectTimeout = config.connectTimeout ?? 5000;
    this.requestTimeout = config.requestTimeout ?? 10000;
    this.maxRetries = config.maxRetries ?? 3; // Fewer retries for gap persistence (non-critical)
    this.baseRetryDelay = config.baseRetryDelay ?? 500;
    this.maxRetryDelay = config.maxRetryDelay ?? 4000;
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
      logger.warn('Received gap response for unknown request', { messageId });
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
    payload: GapSavePayload | GapLoadPayload | GapMarkSyncedPayload
  ): GapMessage {
    return {
      id: randomUUID(),
      type: 'gap',
      payload,
      timestamp: Date.now(),
    };
  }

  /**
   * Save a gap record
   */
  async saveGap(gap: GapRecordInputDTO): Promise<void> {
    const message = this.createMessage({
      action: 'gap_save',
      gap,
    });

    const response = await this.sendRequestWithRetry(message);

    if (!response.success) {
      throw new Error(`Failed to save gap record: ${response.error}`);
    }
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
