/**
 * Public interface types for @flowtrace/ipc
 *
 * These types define the public API contracts for IPC components.
 * Consumers should use these types for type annotations instead of
 * importing internal implementation classes.
 *
 * @module @flowtrace/ipc/types
 */

import type {
  QueueMessageDTO,
  GapRecordDTO,
  GapRecordInputDTO,
  GapLoadOptionsDTO,
} from './dto/dto.js';

// =============================================================================
// Config Types
// =============================================================================

/**
 * Configuration for IPC Server (Unix Socket Server)
 */
export interface IPCServerConfig {
  /** Path to the Unix socket file */
  socketPath: string;
  /** Maximum number of concurrent connections (default: 100) */
  maxConnections?: number;
}

/**
 * Configuration for IPC Client (Unix Socket Client)
 */
export interface IPCClientConfig {
  /** Path to the Unix socket file */
  socketPath: string;
  /** Connection timeout in milliseconds (default: 5000) */
  connectTimeout?: number;
  /** Reconnection delay in milliseconds */
  reconnectDelay?: number;
}

/**
 * Configuration for RuntimeDatabase
 */
export interface RuntimeDatabaseConfig {
  /** Path to the runtime database file */
  runtimeDbPath: string;
  /** Retention hours for processed messages (default: 24) */
  retentionHours?: number;
}

/**
 * Configuration for RuntimeDatabasePoller
 */
export interface RuntimeDatabasePollerConfig {
  /** RuntimeDatabase instance to poll */
  database: RuntimeDB;
  /** Poll interval in milliseconds (default: 1000) */
  pollInterval?: number;
  /** Number of messages to dequeue per poll (default: 50) */
  batchSize?: number;
}

// =============================================================================
// Handler Types
// =============================================================================

/**
 * Message handler function type for IPC Server (fire-and-forget)
 */
export type MessageHandler = (message: unknown) => Promise<void> | void;

/**
 * Request/Response handler function type for IPC Server
 * Returns a response object that will be sent back to the client
 */
export type RequestResponseHandler = (
  message: unknown
) => Promise<unknown> | unknown;

/**
 * Queue message handler function type for RuntimeDatabasePoller
 */
export type QueueMessageHandler = (message: QueueMessageDTO) => Promise<void>;

// =============================================================================
// Instance Types (Public Interfaces)
// =============================================================================

/**
 * IPC Server interface - listens for messages via Unix socket
 */
export interface IPCServer {
  /**
   * Set the message handler function (fire-and-forget mode)
   * @param handler - Function to handle incoming messages
   */
  setMessageHandler(handler: MessageHandler): void;

  /**
   * Set the request handler function (request/response mode)
   * Handler should return a response object that will be sent back to client
   * @param handler - Function to handle incoming requests and return responses
   */
  setRequestHandler(handler: RequestResponseHandler): void;

  /**
   * Start the Unix socket server
   */
  start(): Promise<void>;

  /**
   * Stop the Unix socket server
   */
  stop(): Promise<void>;

  /**
   * Check if the server is listening
   */
  isListening(): boolean;
}

/**
 * IPC Client interface - sends messages via Unix socket
 */
export interface IPCClient {
  /**
   * Connect to the Unix socket server
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the Unix socket server
   */
  disconnect(): void;

  /**
   * Send a message through the Unix socket
   * @param message - Message to send
   */
  send(message: unknown): Promise<void>;

  /**
   * Check if the client is connected
   */
  isConnected(): boolean;
}

/**
 * RuntimeDatabase interface - message queue and state persistence
 */
export interface RuntimeDB {
  // Queue methods
  /**
   * Enqueue a message
   * @param message - Message to enqueue
   */
  enqueue(message: QueueMessageDTO): void;

  /**
   * Dequeue messages (retrieve unprocessed messages)
   * @param batchSize - Number of messages to dequeue
   */
  dequeue(batchSize: number): QueueMessageDTO[];

  /**
   * Mark a message as processed
   * @param messageId - ID of the message to mark
   */
  markProcessed(messageId: string): void;

  /**
   * Clean up old processed messages
   * @param retentionHours - Hours to retain processed messages
   * @returns Number of messages deleted
   */
  cleanup(retentionHours: number): number;

  // State persistence methods
  /**
   * Save a single CandleGroup state
   * @param exchange - Exchange identifier
   * @param symbol - Symbol identifier
   * @param stateJson - JSON string of the state
   */
  saveState(exchange: string, symbol: string, stateJson: string): void;

  /**
   * Save multiple CandleGroup states in a single transaction
   * @param states - Array of exchange/symbol/state tuples
   */
  saveStateBatch(
    states: Array<{ exchange: string; symbol: string; stateJson: string }>
  ): void;

  /**
   * Load a single CandleGroup state
   * @param exchange - Exchange identifier
   * @param symbol - Symbol identifier
   * @returns JSON string of the state or null if not found
   */
  loadState(exchange: string, symbol: string): string | null;

  /**
   * Load states for specific symbols within an exchange
   * @param exchange - Exchange identifier
   * @param symbols - Array of symbol identifiers
   */
  loadStatesBatch(
    exchange: string,
    symbols: string[]
  ): Array<{ exchange: string; symbol: string; stateJson: string }>;

  /**
   * Load all persisted CandleGroup states
   */
  loadAllStates(): Array<{
    exchange: string;
    symbol: string;
    stateJson: string;
  }>;

  /**
   * Load all states for a specific exchange
   * @param exchange - Exchange identifier
   */
  loadStatesByExchange(
    exchange: string
  ): Array<{ exchange: string; symbol: string; stateJson: string }>;

  // Gap record methods
  /**
   * Save a gap record
   * @param gap - Gap record to save
   */
  saveGap(gap: GapRecordInputDTO): void;

  /**
   * Save multiple gap records in a single transaction
   * @param gaps - Array of gap records to save
   */
  saveGapBatch(gaps: GapRecordInputDTO[]): void;

  /**
   * Load gap records with optional filtering
   * @param options - Filter options
   */
  loadGaps(options?: GapLoadOptionsDTO): GapRecordDTO[];

  /**
   * Mark gap records as synced
   * @param gapIds - Array of gap IDs to mark
   */
  markGapsSynced(gapIds: number[]): void;

  // Migration methods
  /**
   * Get the current schema version
   */
  getSchemaVersion(): number;

  // Lifecycle
  /**
   * Close the database connection
   */
  close(): void;
}

/**
 * RuntimeDatabasePoller interface - polls queue for messages
 */
export interface RuntimeDBPoller {
  /**
   * Set the message handler callback
   * @param handler - Function to handle dequeued messages
   */
  setOnMessage(handler: QueueMessageHandler): void;

  /**
   * Start polling the queue
   */
  start(): Promise<void>;

  /**
   * Stop polling the queue
   */
  stop(): Promise<void>;

  /**
   * Check if the poller is running
   */
  isRunning(): boolean;
}
