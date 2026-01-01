/**
 * Data Transfer Objects: AssignSymbolToWorker Use Case
 * Request/Response contracts for symbol assignment business logic
 */

export interface AssignSymbolToWorkerRequest {
  symbol: string;
  workerId?: string; // Optional: specify worker, otherwise use consistent hashing
  force?: boolean; // Optional: force re-assignment if already owned
}

export interface AssignSymbolToWorkerResult {
  success: boolean;
  symbol: string;
  assignedWorkerId: string;
  action: 'assigned' | 'reassigned' | 'already_assigned' | 'no_workers_available';
  message: string;
}
