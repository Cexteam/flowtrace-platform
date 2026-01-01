/**
 * Worker Assignment Repository Interface
 * Domain layer - defines data access contract for worker assignments
 */

/**
 * Worker Assignment domain model
 */
export interface WorkerAssignment {
  symbolKey: string;
  symbol: string;
  exchange: string;
  workerId: number;
  assignedAt: Date;
}

/**
 * Repository interface for worker assignment persistence
 * Follows project standard: NO 'I' prefix for domain repositories
 */
export interface WorkerAssignmentRepository {
  /**
   * Save worker assignment (insert or update)
   */
  save(assignment: WorkerAssignment): Promise<void>;

  /**
   * Find assignments by worker ID
   */
  findByWorker(workerId: number): Promise<WorkerAssignment[]>;

  /**
   * Find assignments by exchange
   */
  findByExchange(exchange: string): Promise<WorkerAssignment[]>;

  /**
   * Get assignment for specific symbol
   */
  getAssignment(
    symbol: string,
    exchange: string
  ): Promise<WorkerAssignment | null>;

  /**
   * Remove assignment
   */
  removeAssignment(symbol: string, exchange: string): Promise<void>;
}
