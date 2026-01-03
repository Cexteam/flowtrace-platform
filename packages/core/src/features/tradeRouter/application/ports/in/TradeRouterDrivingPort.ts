/**
 * PORT IN - Driving Interface
 * Defines how external actors interact with and drive the Trade Router feature
 *
 * Extended to include worker pool management methods so that marketData
 * doesn't need to import from workerManagement directly.
 **/

import type {
  WorkerPoolConfig,
  WorkerPoolStatus,
} from '../../../../workerManagement/application/ports/in/WorkerPoolPort.js';

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

export interface TradeRouterDrivingPort {
  // ============ Core Trade Routing ============

  /**
   * Core responsibility: Route trades from WebSocket streams to appropriate workers
   */
  routeTrades(
    symbol: string,
    trades: any[],
    options?: {
      priority?: 'urgent' | 'normal';
      batchId?: string;
    }
  ): Promise<any>;

  // ============ Symbol Management ============

  /**
   * Management: Assign symbols to workers for ownership/routing
   */
  assignSymbolToWorker(symbol: string, workerId?: string): Promise<void>;

  /**
   * Management: Remove symbol assignment from worker
   */
  removeSymbolFromWorker(symbol: string): Promise<void>;

  // ============ Worker Pool Management ============
  // These methods delegate to workerManagement so marketData doesn't need
  // to import from workerManagement directly

  /**
   * Initialize the worker pool with the specified configuration
   * Delegates to WorkerPoolPort.initialize()
   */
  initializeWorkerPool(config: WorkerPoolConfig): Promise<void>;

  /**
   * Initialize symbol routing to workers
   * Assigns symbols to workers and sends WORKER_INIT messages
   */
  initializeSymbolRouting(
    symbols: string[],
    socketPath: string
  ): Promise<InitializeSymbolRoutingResult>;

  /**
   * Get all worker IDs in the pool
   * Delegates to WorkerPoolPort.getWorkerIds()
   */
  getWorkerIds(): string[];

  /**
   * Get the current status of the worker pool
   * Delegates to WorkerPoolPort.getStatus()
   */
  getWorkerPoolStatus(): WorkerPoolStatus;

  /**
   * Gracefully shutdown all workers in the pool
   * Delegates to WorkerPoolPort.shutdown()
   */
  shutdown(): Promise<void>;
}

// Re-export types for convenience
export type { WorkerPoolConfig, WorkerPoolStatus };
