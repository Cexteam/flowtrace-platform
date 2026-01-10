/**
 * IPCStatePersistenceAdapter
 *
 * Implements StatePersistencePort using Unix Socket IPC to communicate
 * with the persistence service. Handles request/response pattern with
 * retry logic and exponential backoff.
 *
 */

import { injectable, inject } from 'inversify';
import * as net from 'net';
import { randomUUID } from 'crypto';
import type { StatePersistencePort } from '../../application/ports/out/StatePersistencePort.js';
import type {
  StateMessage,
  StateResponse,
  StateSavePayload,
  StateSaveBatchPayload,
  StateLoadPayload,
  StateLoadBatchPayload,
  StateLoadAllPayload,
} from '@flowtrace/ipc';
import { createLogger } from '../../../../shared/lib/logger/logger.js';

const logger = createLogger('IPCStatePersistenceAdapter');

/**
 * Configuration for IPCStatePersistenceAdapter
 */
export interface IPCStatePersistenceConfig {
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
  resolve: (response: StateResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * IPCStatePersistenceAdapter
 * Implements StatePersistencePort with Unix Socket IPC and request/response pattern
 */
@injectable()
export class IPCStatePersistenceAdapter implements StatePersistencePort {
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
    @inject('IPC_STATE_PERSISTENCE_CONFIG')
    config: IPCStatePersistenceConfig
  ) {
    this.socketPath = config.socketPath;
    this.connectTimeout = config.connectTimeout ?? 5000;
    this.requestTimeout = config.requestTimeout ?? 10000;
    this.maxRetries = config.maxRetries ?? 5;
    this.baseRetryDelay = config.baseRetryDelay ?? 1000;
    this.maxRetryDelay = config.maxRetryDelay ?? 16000;
  }

  /**
   * Connect to persistence service via Unix Socket
   * Implements retry logic with exponential backoff
   */
  async connect(): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        await this.attemptConnect();
        logger.info('Connected to persistence service', {
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

        logger.warn('Connection attempt failed, retrying', {
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
      `Failed to connect to persistence service after ${this.maxRetries} attempts: ${lastError?.message}`
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
          logger.error('Failed to parse response', {
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
      logger.warn('Received response without id', { response });
      return;
    }

    const messageId = (response as { id: string }).id;
    const pending = this.pendingRequests.get(messageId);

    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(messageId);
      // Cast to StateResponse - the response should have success field
      const stateResponse = response as unknown as StateResponse;
      pending.resolve(stateResponse);
    } else {
      // Late response - request already timed out and was removed
      logger.debug('Received late response for completed request', {
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
  private async sendRequest<T extends StateResponse>(
    message: StateMessage
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
        resolve: resolve as (response: StateResponse) => void,
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
   * Create a state message
   */
  private createMessage(
    payload:
      | StateSavePayload
      | StateSaveBatchPayload
      | StateLoadPayload
      | StateLoadBatchPayload
      | StateLoadAllPayload
  ): StateMessage {
    return {
      id: randomUUID(),
      type: 'state',
      payload,
      timestamp: Date.now(),
    };
  }

  /**
   * Save a single CandleGroup state
   */
  async saveState(
    exchange: string,
    symbol: string,
    stateJson: string
  ): Promise<void> {
    const message = this.createMessage({
      action: 'save',
      exchange,
      symbol,
      stateJson,
    });

    const response = await this.sendRequestWithRetry(message);

    if (!response.success) {
      throw new Error(`Failed to save state: ${response.error}`);
    }

    logger.debug('State saved', { exchange, symbol });
  }

  /**
   * Save multiple CandleGroup states in batch
   */
  async saveStateBatch(
    states: Array<{ exchange: string; symbol: string; stateJson: string }>
  ): Promise<void> {
    const message = this.createMessage({
      action: 'save_batch',
      states,
    });

    const response = await this.sendRequestWithRetry(message);

    if (!response.success) {
      throw new Error(`Failed to save state batch: ${response.error}`);
    }

    logger.debug('State batch saved', { count: states.length });
  }

  /**
   * Load a single CandleGroup state
   */
  async loadState(exchange: string, symbol: string): Promise<string | null> {
    const message = this.createMessage({
      action: 'load',
      exchange,
      symbol,
    });

    const response = await this.sendRequestWithRetry(message);

    if (!response.success) {
      throw new Error(`Failed to load state: ${response.error}`);
    }

    return response.data?.stateJson ?? null;
  }

  /**
   * Load states for specific symbols
   */
  async loadStatesBatch(
    exchange: string,
    symbols: string[]
  ): Promise<Array<{ exchange: string; symbol: string; stateJson: string }>> {
    if (symbols.length === 0) {
      return [];
    }

    const message = this.createMessage({
      action: 'load_batch',
      exchange,
      symbols,
    });

    const response = await this.sendRequestWithRetry(message);

    if (!response.success) {
      throw new Error(`Failed to load states batch: ${response.error}`);
    }

    return response.data?.states ?? [];
  }

  /**
   * Load all persisted CandleGroup states
   */
  async loadAllStates(): Promise<
    Array<{ exchange: string; symbol: string; stateJson: string }>
  > {
    const message = this.createMessage({
      action: 'load_all',
    });

    const response = await this.sendRequestWithRetry(message);

    if (!response.success) {
      throw new Error(`Failed to load all states: ${response.error}`);
    }

    return response.data?.states ?? [];
  }

  /**
   * Send request with retry logic
   */
  private async sendRequestWithRetry(
    message: StateMessage
  ): Promise<StateResponse> {
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

        logger.warn('Request failed, retrying', {
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
      `Request failed after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }
}
