/**
 * WorkerCommunicationPort - Inbound port for worker communication
 *
 * Defines the contract for sending messages to worker threads.
 * This port is only available in the main thread.
 *
 */

/**
 * Message types that can be sent to workers
 */
export type WorkerMessageType =
  | 'WORKER_INIT'
  | 'PROCESS_TRADES_FULL'
  | 'SYMBOL_ASSIGNMENT'
  | 'WORKER_STATUS'
  | 'PUBLISH_DIRECT'
  | 'SYNC_METRICS'
  | 'PROCESS_TRADES'
  | 'CALCULATE_FOOTPRINT'
  | 'UPDATE_BUFFER'
  | 'HEARTBEAT'
  | 'WORKER_READY'
  | 'SHUTDOWN'
  | 'FLUSH_COMPLETE';

/**
 * Message sent by worker to main thread when initialization is complete
 */
export interface WorkerReadyMessage {
  /** Message type identifier */
  type: 'WORKER_READY';
  /** Unique identifier of the worker that is ready */
  workerId: string;
  /** Timestamp when worker became ready (ms since epoch) */
  timestamp: number;
}

/**
 * Message structure for worker communication
 */
export interface WorkerMessage {
  /** Unique message identifier for response correlation */
  id: string;
  /** Type of message being sent */
  type: WorkerMessageType;
  /** Message payload data */
  data: unknown;
  /** Optional timestamp */
  timestamp?: Date;
}

/**
 * Response structure from worker
 */
export interface WorkerResponse {
  /** Message ID this response correlates to */
  id: string;
  /** Whether the operation succeeded */
  success: boolean;
  /** Result data if successful */
  result?: unknown;
  /** Error message if failed */
  error?: string;
  /** Processing time in milliseconds */
  processingTimeMs?: number;
}

/**
 * Options for sending messages to workers
 */
export interface SendMessageOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Priority level for message processing */
  priority?: 'urgent' | 'normal';
}

/**
 * WorkerCommunicationPort - Inbound port interface for worker communication
 *
 * Provides methods to send messages to individual workers or broadcast to all.
 */
export interface WorkerCommunicationPort {
  /**
   * Send a message to a specific worker
   *
   * @param workerId - Target worker's unique identifier
   * @param message - Message to send
   * @param options - Optional send configuration
   * @returns Promise resolving to worker's response
   * @throws Error if worker not found or timeout occurs
   */
  sendToWorker(
    workerId: string,
    message: WorkerMessage,
    options?: SendMessageOptions
  ): Promise<WorkerResponse>;

  /**
   * Broadcast a message to all workers
   *
   * @param message - Message to broadcast
   * @param options - Optional send configuration
   * @returns Promise resolving to array of responses from all workers
   */
  broadcastToAll(
    message: Omit<WorkerMessage, 'id'>,
    options?: SendMessageOptions
  ): Promise<WorkerResponse[]>;

  /**
   * Send trades to a worker for processing
   *
   * @param workerId - Target worker's unique identifier
   * @param symbol - Trading symbol
   * @param trades - Array of trade data
   * @param config - Optional processing configuration
   * @returns Promise resolving to processing result
   */
  sendTrades(
    workerId: string,
    symbol: string,
    trades: unknown[],
    config?: {
      tickValue?: number;
      exchange?: string;
      isNewSymbol?: boolean;
    }
  ): Promise<WorkerResponse>;

  /**
   * Initialize a worker with configuration
   *
   * @param workerId - Target worker's unique identifier
   * @param config - Worker initialization configuration
   * @returns Promise resolving when worker is initialized
   *
   * All deployments now use IPC-based persistence via socketPath.
   */
  initializeWorker(
    workerId: string,
    config: {
      socketPath?: string;
      assignedSymbols: string[];
    }
  ): Promise<void>;
}
