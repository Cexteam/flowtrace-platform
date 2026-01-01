/**
 * Data Transfer Objects for SaveGap use case
 */

import type { GapRecordInputDTO } from '@flowtrace/ipc';

/**
 * Request for saving a gap record
 */
export interface SaveGapRequest {
  gap: GapRecordInputDTO;
}

/**
 * Result of saving a gap record
 */
export interface SaveGapResult {
  success: boolean;
  symbol: string;
  savedAt: number;
}
