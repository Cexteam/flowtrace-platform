/**
 * WorkerManagementPort - Unified inbound port for worker management
 *
 * Consolidates WorkerPoolPort + WorkerCommunicationPort + TradeRouterDrivingPort
 * into a single interface for worker lifecycle, communication, and trade routing.
 *
 * This port is only available in the main thread.
 */

import { WorkerThread } from '../../../domain/entities/WorkerThread.js';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for initializing the worker pool
 */
export interface WorkerPoolConfig {
  /** Number of workers to spawn */
  workerCount: number;
  /**
   * Path to worker entry point script (optional)
   * If not provided, NodeWorkerThreadAdapter will use the default path
   */
  workerScript?: string;
  /**
   * IPC socket path for persistence service communication
   * Workers use this to connect to the persistence service
   */
  socketPath?: string;
  /**
   * Timeout in milliseconds to wait for all workers to send WORKER_READY
   * @default 10000 (10 seconds)
   */
  readyTimeout?: number;
}

// ============================================================================
// Message Types
// ============================================================================

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

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of routing trades to a worker
 */
export interface RouteTradesResult {
  success: boolean;
  workerId: string;
  processingTime: number;
  symbol: string;
  tradeCount: number;
  batchId?: string;
  error?: string;
}

/**
 * Result of initializing symbol routing
 */
export interface InitializeSymbolRoutingResult {
  /** Whether all symbols were successfully assigned */
  success: boolean;
  /** Number of symbols successfully assigned */
  assignedSymbols: number;
  /** List of symbols that failed to assign */
  failedSymbols: string[];
  /** Results per worker */
  workerInitResults: Map<string, { success: boolean; symbolCount: number }>;
}

// ============================================================================
// Port Interface
// ============================================================================

/**
 * WorkerManagementPort - Unified inbound port interface
 *
 * Provides methods for:
 * - Worker pool lifecycle (initialize, shutdown)
 * - Worker communication (sendToWorker, broadcastToAll)
 * - Trade routing (routeTrades, initializeSymbolRouting)
 * - Symbol management (assignSymbolToWorker, removeSymbolFromWorker)
 */
export interface WorkerManagementPort {
  // ============ Lifecycle ============

  /**
   * Initialize the worker pool with the specified configuration
   *
   * @param config - Worker pool configuration
   * @returns Promise that resolves when all workers are initialized and ready
   */
  initialize(config: WorkerPoolConfig): Promise<void>;

  /**
   * Gracefully shutdown all workers in the pool
   *
   * @returns Promise that resolves when all workers are terminated
   */
  shutdown(): Promise<void>;

  // ============ Communication ============

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
   * @param message - Message to broadcast (id will be auto-generated)
   * @param options - Optional send configuration
   * @returns Promise resolving to array of responses from all workers
   */
  broadcastToAll(
    message: Omit<WorkerMessage, 'id'>,
    options?: SendMessageOptions
  ): Promise<WorkerResponse[]>;

  // ============ Trade Routing ============

  /**
   * Route trades to the appropriate worker based on symbol ownership
   *
   * Uses consistent hashing to ensure same symbol always routes to same worker.
   *
   * @param symbol - Trading symbol
   * @param trades - Array of trade data
   * @param options - Optional routing configuration
   * @returns Promise resolving to routing result
   */
  routeTrades(
    symbol: string,
    trades: unknown[],
    options?: { priority?: 'urgent' | 'normal'; batchId?: string }
  ): Promise<RouteTradesResult>;

  /**
   * Initialize symbol routing to workers
   *
   * Assigns symbols to workers using consistent hashing and sends
   * WORKER_INIT messages with assigned symbols.
   *
   * @param symbols - List of symbols to route
   * @param socketPath - IPC socket path for persistence
   * @returns Promise resolving to initialization result
   */
  initializeSymbolRouting(
    symbols: string[],
    socketPath: string
  ): Promise<InitializeSymbolRoutingResult>;

  // ============ Symbol Management ============

  /**
   * Assign a symbol to a worker for ownership
   *
   * @param symbol - Symbol to assign
   * @param workerId - Optional specific worker ID (uses consistent hashing if not provided)
   */
  assignSymbolToWorker(symbol: string, workerId?: string): Promise<void>;

  /**
   * Remove a symbol from its assigned worker
   *
   * @param symbol - Symbol to remove
   */
  removeSymbolFromWorker(symbol: string): Promise<void>;

  // ============ Internal Access (for WorkerStatusPort) ============

  /**
   * Get a specific worker by ID
   * Used internally by WorkerStatusService
   *
   * @param workerId - The worker's unique identifier
   * @returns The worker thread or undefined if not found
   */
  getWorker(workerId: string): WorkerThread | undefined;

  /**
   * Check if a worker exists in the pool
   *
   * @param workerId - The worker's unique identifier
   * @returns true if worker exists, false otherwise
   */
  hasWorker(workerId: string): boolean;
}
