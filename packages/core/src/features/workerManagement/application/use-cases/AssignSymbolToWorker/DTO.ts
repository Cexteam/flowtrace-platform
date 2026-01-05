/**
 * Data Transfer Objects: AssignSymbolToWorker Use Case
 */

import type { WorkerThread } from '../../../domain/entities/WorkerThread.js';

export interface AssignSymbolToWorkerRequest {
  symbol: string;
  workerId?: string; // Optional: specify worker, otherwise use consistent hashing
  force?: boolean; // Optional: force re-assignment if already owned
  workers: Map<string, WorkerThread>; // Workers Map from WorkerManagementService
}

export interface AssignSymbolToWorkerResult {
  success: boolean;
  symbol: string;
  assignedWorkerId: string;
  action:
    | 'assigned'
    | 'reassigned'
    | 'already_assigned'
    | 'no_workers_available';
  message: string;
}
