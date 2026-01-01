/**
 * PORT IN - Worker Manager Interface
 * Defines how external actors manage worker lifecycles in the Trade Router feature
 *
 * All deployments now use IPC-based persistence via socketPath.
 **/

// New naming convention - clear port intent
export interface WorkerManagerDrivingPort {
  /**
   * Add a new worker to the routing system
   */
  addWorker(worker: any, workerId: string): void;

  /**
   * Initialize worker with socket path and symbol assignment
   */
  initializeWorker(
    workerId: string,
    socketPath: string | undefined,
    initialSymbols: string[]
  ): Promise<void>;

  /**
   * Remove worker from routing system and cleanup resources
   */
  removeWorker(workerId: string): Promise<void>;
}
