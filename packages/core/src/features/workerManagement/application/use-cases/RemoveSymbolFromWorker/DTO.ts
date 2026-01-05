/**
 * Data Transfer Objects: RemoveSymbolFromWorker Use Case
 */

import type { WorkerThread } from '../../../domain/entities/WorkerThread.js';

export interface RemoveSymbolFromWorkerRequest {
  symbol: string;
  workerId?: string; // Optional: specify worker, otherwise auto-discover
  force?: boolean; // Optional: force removal even if worker verification fails
  workers: Map<string, WorkerThread>; // Workers Map from WorkerManagementService
}

export interface RemoveSymbolFromWorkerResult {
  success: boolean;
  symbol: string;
  removedFromWorkerId: string;
  action:
    | 'removed'
    | 'not_found'
    | 'not_owned_by_specified_worker'
    | 'force_removed';
  message: string;
}
