/**
 * DTO Module - Public Data Transfer Objects and Validation
 *
 * This module exports all DTOs, Zod schemas, and validation functions
 * for IPC communication between packages.
 *
 */

// =============================================================================
// DTO Types (Data Transfer Objects)
// =============================================================================

export type {
  // Queue & State DTOs
  QueueMessageDTO,
  StateEntryDTO,
  // Candle DTOs
  AggsDTO,
  FootprintCandleDTO,
  CandleGroupDTO,
  // Gap Record DTOs
  GapRecordDTO,
  GapRecordInputDTO,
  GapLoadOptionsDTO,
} from './dto.js';

// =============================================================================
// IPC Message Types (Protocol types)
// =============================================================================

export type {
  IPCMessage,
  StateMessage,
  StateSavePayload,
  StateSaveBatchPayload,
  StateLoadPayload,
  StateLoadBatchPayload,
  StateLoadAllPayload,
  StateResponse,
  GapMessage,
  GapSavePayload,
  GapSaveBatchPayload,
  GapLoadPayload,
  GapMarkSyncedPayload,
  GapResponse,
} from './types.js';

// =============================================================================
// Zod Validation Schemas
// =============================================================================

export {
  // Queue & State Schemas
  QueueMessageDTOSchema,
  StateEntryDTOSchema,
  // Candle Schemas
  AggsDTOSchema,
  FootprintCandleDTOSchema,
  CandleGroupDTOSchema,
  // Gap Schemas
  GapRecordDTOSchema,
  GapRecordInputDTOSchema,
} from './schemas.js';

// =============================================================================
// Validation Functions (throwing)
// =============================================================================

export {
  validateQueueMessageDTO,
  validateStateEntryDTO,
  validateAggsDTO,
  validateFootprintCandleDTO,
  validateCandleGroupDTO,
  validateGapRecordDTO,
  validateGapRecordInputDTO,
} from './schemas.js';

// =============================================================================
// Safe Validation Functions (non-throwing)
// =============================================================================

export {
  safeValidateQueueMessageDTO,
  safeValidateStateEntryDTO,
  safeValidateAggsDTO,
  safeValidateFootprintCandleDTO,
  safeValidateCandleGroupDTO,
  safeValidateGapRecordDTO,
  safeValidateGapRecordInputDTO,
} from './schemas.js';
