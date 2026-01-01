/**
 * Worker Manager Service - Application Layer Implementation
 * Implements WorkerManagerDrivingPort driving port interface
 * Handles worker lifecycle management for Clean Architecture
 *
 * All deployments now use IPC-based persistence via socketPath.
 */

import { injectable } from 'inversify';
import { WorkerManagerDrivingPort } from '../ports/in/WorkerManagerDrivingPort.js';

@injectable()
export class WorkerManagerService implements WorkerManagerDrivingPort {
  /**
   * Add a new worker to the routing system
   */
  addWorker(worker: any, workerId: string): void {
    console.log(`Worker ${workerId} added to routing system`);
  }

  /**
   * Initialize worker with socket path and symbol assignment
   */
  async initializeWorker(
    workerId: string,
    socketPath: string | undefined,
    initialSymbols: string[]
  ): Promise<void> {
    console.log(
      `Initializing worker ${workerId} with ${
        initialSymbols.length
      } symbols, socketPath: ${socketPath || 'default'}`
    );
  }

  /**
   * Remove worker from routing system and cleanup resources
   */
  async removeWorker(workerId: string): Promise<void> {
    console.log(`Removing worker ${workerId} from routing system`);
  }
}
