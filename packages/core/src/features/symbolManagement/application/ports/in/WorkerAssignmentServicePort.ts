/**
 * Worker Assignment Service Port - Inbound Port
 *
 * Defines the contract for worker assignment operations.
 * This is a DRIVING port (inbound) in Hexagonal Architecture.
 *
 * External actors (cron jobs, controllers) interact with the system through this interface.
 */

export interface WorkerAssignment {
  symbolKey: string;
  symbol: string;
  exchange: string;
  workerId: number;
  assignedAt: Date;
}

/**
 * Worker Assignment Service Interface
 *
 * Handles assignment of symbols to workers using consistent hashing
 * NOTE: NO 'I' prefix - this is the project standard
 */
export interface WorkerAssignmentServicePort {
  /**
   * Assign a symbol to a worker using consistent hashing
   * @param symbol - Symbol name (e.g., "BTCUSDT")
   * @param exchange - Exchange name (e.g., "binance")
   * @param totalWorkers - Total number of workers available
   * @returns Worker ID assigned to this symbol
   */
  assignSymbolToWorker(
    symbol: string,
    exchange: string,
    totalWorkers: number
  ): Promise<number>;

  /**
   * Find worker assignments by worker ID
   * @param workerId - Worker ID to query
   * @returns Array of assignments for this worker
   */
  findByWorker(workerId: number): Promise<WorkerAssignment[]>;

  /**
   * Find worker assignments by exchange
   * @param exchange - Exchange name to query
   * @returns Array of assignments for this exchange
   */
  findByExchange(exchange: string): Promise<WorkerAssignment[]>;

  /**
   * Remove worker assignment for a symbol
   * Used when a symbol is deactivated
   * @param symbol - Symbol name
   * @param exchange - Exchange name
   */
  removeAssignment(symbol: string, exchange: string): Promise<void>;

  /**
   * Get assignment for a specific symbol
   * @param symbol - Symbol name
   * @param exchange - Exchange name
   * @returns Worker assignment or null if not found
   */
  getAssignment(
    symbol: string,
    exchange: string
  ): Promise<WorkerAssignment | null>;
}
