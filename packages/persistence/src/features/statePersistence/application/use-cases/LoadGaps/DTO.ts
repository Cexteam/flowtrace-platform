/**
 * Data Transfer Objects for LoadGaps use case
 */

import type { GapRecordDTO, GapLoadOptionsDTO } from '@flowtrace/ipc';

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
  success: boolean;
  gaps: GapRecordDTO[];
  loadedAt: number;
}
