/**
 * RuntimeGapStorageAdapter - Implements GapStoragePort using RuntimeDatabase
 * Provides gap record storage operations using the RuntimeDatabase from @flowtrace/ipc.
 */

import { injectable, inject } from 'inversify';
import type {
  RuntimeDB,
  GapRecordDTO,
  GapRecordInputDTO,
  GapLoadOptionsDTO,
} from '@flowtrace/ipc';
import type { GapStoragePort } from '../../application/ports/out/GapStoragePort.js';
import { IPC_TYPES } from '../../../../infrastructure/ipc/di/module.js';

/**
 * Adapter that implements GapStoragePort using RuntimeDatabase
 */
@injectable()
export class RuntimeGapStorageAdapter implements GapStoragePort {
  constructor(
    @inject(IPC_TYPES.RuntimeDatabase)
    private readonly runtimeDb: RuntimeDB
  ) {}

  /**
   * Save a gap record
   *
   * @param gap - Gap record input data
   */
  async save(gap: GapRecordInputDTO): Promise<void> {
    this.runtimeDb.saveGap(gap);
  }

  /**
   * Save multiple gap records in a single transaction
   *
   * @param gaps - Array of gap record input data
   */
  async saveBatch(gaps: GapRecordInputDTO[]): Promise<void> {
    this.runtimeDb.saveGapBatch(gaps);
  }

  /**
   * Load gap records with optional filtering
   *
   * @param options - Filter options (symbol, syncedOnly)
   * @returns Array of gap records
   */
  async load(options?: GapLoadOptionsDTO): Promise<GapRecordDTO[]> {
    return this.runtimeDb.loadGaps(options);
  }

  /**
   * Mark gap records as synced
   *
   * @param gapIds - Array of gap record IDs to mark as synced
   */
  async markSynced(gapIds: number[]): Promise<void> {
    this.runtimeDb.markGapsSynced(gapIds);
  }
}
