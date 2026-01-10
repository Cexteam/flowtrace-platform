/**
 * Shared types for IPC infrastructure
 *
 * This file defines the IPC MESSAGE PROTOCOL - how packages communicate.
 * For DATA STRUCTURES (DTOs), see dto.ts
 *
 */

import type {
  GapRecordDTO,
  GapRecordInputDTO,
  GapLoadOptionsDTO,
} from './dto.js';

/**
 * Base IPC message structure
 * This is the protocol-level message wrapper, not a DTO for storage
 */
export interface IPCMessage {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
}

// =============================================================================
// State Persistence Message Types
// =============================================================================

/**
 * State message for IPC communication
 */
export interface StateMessage extends IPCMessage {
  type: 'state';
  payload:
    | StateSavePayload
    | StateSaveBatchPayload
    | StateLoadPayload
    | StateLoadBatchPayload
    | StateLoadAllPayload;
}

/**
 * Payload for saving a single state
 */
export interface StateSavePayload {
  action: 'save';
  exchange: string;
  symbol: string;
  stateJson: string;
}

/**
 * Payload for saving multiple states in batch
 */
export interface StateSaveBatchPayload {
  action: 'save_batch';
  states: Array<{ exchange: string; symbol: string; stateJson: string }>;
}

/**
 * Payload for loading a single state
 */
export interface StateLoadPayload {
  action: 'load';
  exchange: string;
  symbol: string;
}

/**
 * Payload for loading states for specific symbols (worker's assigned symbols)
 */
export interface StateLoadBatchPayload {
  action: 'load_batch';
  exchange: string;
  symbols: string[];
}

/**
 * Payload for loading all states
 */
export interface StateLoadAllPayload {
  action: 'load_all';
}

/**
 * Response type for state operations
 */
export interface StateResponse {
  success: boolean;
  data?: {
    stateJson?: string | null;
    states?: Array<{ exchange: string; symbol: string; stateJson: string }>;
  };
  error?: string;
}

// =============================================================================
// Gap Record Message Types
// =============================================================================

/**
 * Gap message for IPC communication
 */
export interface GapMessage extends IPCMessage {
  type: 'gap';
  payload:
    | GapSavePayload
    | GapSaveBatchPayload
    | GapLoadPayload
    | GapMarkSyncedPayload;
}

/**
 * Payload for saving a gap record
 * Reuses GapRecordInputDTO from dto.ts to avoid duplication
 */
export interface GapSavePayload {
  action: 'gap_save';
  gap: GapRecordInputDTO;
}

/**
 * Payload for saving multiple gap records in batch
 * Used by queue-based gap persistence to reduce IPC overhead
 */
export interface GapSaveBatchPayload {
  action: 'gap_save_batch';
  gaps: GapRecordInputDTO[];
}

/**
 * Payload for loading gap records
 * Extends GapLoadOptionsDTO with action field
 */
export interface GapLoadPayload extends GapLoadOptionsDTO {
  action: 'gap_load';
}

/**
 * Payload for marking gaps as synced
 */
export interface GapMarkSyncedPayload {
  action: 'gap_mark_synced';
  gapIds: number[];
}

/**
 * Response type for gap operations
 * Reuses GapRecordDTO from dto.ts to avoid duplication
 */
export interface GapResponse {
  success: boolean;
  data?: {
    gaps?: GapRecordDTO[];
  };
  error?: string;
}
