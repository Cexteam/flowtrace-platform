/**
 * GapPersistencePort - Inbound port for gap persistence operations
 * Defines the interface for gap persistence operations that can be invoked
 * by external actors (handlers, controllers). This is the primary entry point
 * for gap persistence functionality.
 */

import type {
  GapRecordDTO,
  GapRecordInputDTO,
  GapLoadOptionsDTO,
} from '@flowtrace/ipc';

/**
 * Request for saving a gap record
 */
export interface SaveGapRequest {
  gap: GapRecordInputDTO;
}

/**
 * Request for loading gap records
 */
export interface LoadGapsRequest {
  options?: GapLoadOptionsDTO;
}

/**
 * Result of loading gap records
 */
export interface LoadGapsResult {
  gaps: GapRecordDTO[];
}

/**
 * Request for marking gaps as synced
 */
export interface MarkGapsSyncedRequest {
  gapIds: number[];
}

/**
 * Inbound port for gap persistence operations
 */
export interface GapPersistencePort {
  /**
   * Save a gap record
   *
   * @param request - Save gap request
   */
  saveGap(request: SaveGapRequest): Promise<void>;

  /**
   * Load gap records with optional filtering
   *
   * @param request - Load gaps request with optional filters
   * @returns Load gaps result with gaps array
   */
  loadGaps(request: LoadGapsRequest): Promise<LoadGapsResult>;

  /**
   * Mark gap records as synced
   *
   * @param request - Mark gaps synced request
   */
  markGapsSynced(request: MarkGapsSyncedRequest): Promise<void>;
}
