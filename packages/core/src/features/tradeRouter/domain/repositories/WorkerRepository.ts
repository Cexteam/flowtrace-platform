/**
 * Domain Repository Interface: Worker State Persistence
 * Defines data access contract for worker entities in Clean Architecture
 */

import { WorkerThread } from '../entities/WorkerThread.js';

export interface WorkerRepository {
  // CRUD Operations
  save(worker: WorkerThread): Promise<WorkerThread>;
  findById(workerId: string): Promise<WorkerThread | null>;
  findAll(): Promise<WorkerThread[]>;
  update(worker: WorkerThread): Promise<WorkerThread>;
  delete(workerId: string): Promise<void>;

  // Business-Specific Queries
  findActiveWorkers(): Promise<WorkerThread[]>;
  findWorkersBySymbol(symbol: string): Promise<WorkerThread[]>;
  getSystemLoad(): Promise<WorkerStats[]>;

  // Infrastructure Health Checks
  healthCheck(): Promise<boolean>;
}

// Supporting Types for Repository Operations
export interface WorkerStats {
  workerId: string;
  status: 'active' | 'idle' | 'busy' | 'error';
  symbolCount: number;
  cpuUsage: number;
  memoryUsage: number;
  lastActivity: Date;
  queueSize: number;
  uptimeSeconds: number;
}
