/**
 * Infrastructure Mapper: Domain ↔ Persistence Translation
 * Maps WorkerThread domain entities to/from persistence format
 *
 * All deployments now use IPC-based persistence via SQLite.
 */

import {
  WorkerThread,
  WorkerStatus,
  WorkerType,
} from '../../domain/entities/WorkerThread.js';
import { WorkerHealthMetrics } from '../../domain/entities/WorkerThread.js';

// Persistence structure (previously Redis, now SQLite via IPC)
export interface WorkerPersistenceRecord {
  id: string;
  workerType: WorkerType;
  status: WorkerStatus;
  symbolsOwned: string[]; // symbol array
  createdAt: string;
  lastActivityAt: string;
  healthMetrics: WorkerHealthMetrics;
}

export class WorkerMapper {
  /**
   * Map domain entity to persistence format
   */
  static toPersistence(worker: WorkerThread): WorkerPersistenceRecord {
    return {
      id: worker.id,
      workerType: worker.type,
      status: worker.status,
      symbolsOwned: Array.from(worker.symbolsOwned),
      createdAt: worker.createdAt.toISOString(),
      lastActivityAt: worker.lastActivityAt.toISOString(),
      healthMetrics: worker.healthMetrics,
    };
  }

  /**
   * Map persistence format to domain entity
   */
  static toDomain(record: WorkerPersistenceRecord): WorkerThread {
    const worker = new WorkerThread(
      record.id,
      record.workerType,
      record.status
    );

    // Restore symbol ownership
    worker.symbolsOwned = new Set(record.symbolsOwned);

    // Restore health metrics
    worker.healthMetrics = record.healthMetrics;

    // Restore timestamps
    (worker as any).createdAt = new Date(record.createdAt);
    (worker as any).lastActivityAt = new Date(record.lastActivityAt);

    return worker;
  }

  /**
   * Create empty domain entity for new workers
   */
  static createNew(
    id: string,
    type: WorkerType = 'footprint_processor',
    status: WorkerStatus = 'initializing'
  ): WorkerThread {
    return new WorkerThread(id, type, status);
  }

  /**
   * Update domain entity from partial record
   */
  static updateFromPersistence(
    existing: WorkerThread,
    record: Partial<WorkerPersistenceRecord>
  ): WorkerThread {
    // Apply status update if provided
    if (record.status) {
      existing.setStatus(record.status);
    }

    // Restore symbol ownership if provided
    if (record.symbolsOwned) {
      existing.symbolsOwned = new Set(record.symbolsOwned);
    }

    // Update health metrics if provided
    if (record.healthMetrics) {
      existing.healthMetrics = {
        ...existing.healthMetrics,
        ...record.healthMetrics,
      };
    }

    // Update activity time if provided
    if (record.lastActivityAt) {
      (existing as any).lastActivityAt = new Date(record.lastActivityAt);
    }

    return existing;
  }
}
