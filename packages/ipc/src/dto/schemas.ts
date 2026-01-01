/**
 * Zod validation schemas for shared DTOs
 *
 * Provides runtime validation for data contracts between packages.
 * Each DTO has a corresponding Zod schema for validation.
 *
 * This is the SINGLE SOURCE OF TRUTH for all IPC validation schemas.
 *
 */

import { z } from 'zod';
import type {
  QueueMessageDTO,
  StateEntryDTO,
  AggsDTO,
  FootprintCandleDTO,
  CandleGroupDTO,
  GapRecordDTO,
  GapRecordInputDTO,
} from './dto.js';

// =============================================================================
// Queue Message Schemas
// =============================================================================

/**
 * Zod schema for QueueMessageDTO
 */
export const QueueMessageDTOSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  payload: z.any(),
  timestamp: z.number().positive(),
});

// =============================================================================
// State Persistence Schemas
// =============================================================================

/**
 * Zod schema for StateEntryDTO
 */
export const StateEntryDTOSchema = z.object({
  exchange: z.string().min(1),
  symbol: z.string().min(1),
  stateJson: z.string().min(1),
  updatedAt: z.number().int().positive().optional(),
});

// =============================================================================
// Candle Schemas
// =============================================================================

/**
 * Zod schema for AggsDTO (price bin aggregation)
 */
export const AggsDTOSchema = z.object({
  tp: z.number(),
  bv: z.number().nonnegative(),
  sv: z.number().nonnegative(),
  v: z.number().nonnegative(),
  bq: z.number().nonnegative().optional(),
  sq: z.number().nonnegative().optional(),
  q: z.number().nonnegative().optional(),
});

/**
 * Zod schema for FootprintCandleDTO
 */
export const FootprintCandleDTOSchema = z.object({
  e: z.string(),
  tz: z.string(),
  ex: z.string(),
  a: z.string(),
  s: z.string().min(1),
  i: z.string().min(1),
  vi: z.number().int().positive(),
  t: z.number().int().nonnegative(),
  o: z.number().nonnegative(),
  h: z.number().nonnegative(),
  l: z.number().nonnegative(),
  c: z.number().nonnegative(),
  ct: z.number().int().nonnegative(),
  v: z.number().nonnegative(),
  bv: z.number().nonnegative(),
  sv: z.number().nonnegative(),
  q: z.number().nonnegative(),
  bq: z.number().nonnegative(),
  sq: z.number().nonnegative(),
  n: z.number().int().nonnegative(),
  d: z.number(),
  dMax: z.number(),
  dMin: z.number(),
  tv: z.number().positive(),
  aggs: z.array(AggsDTOSchema),
  f: z.number().int().nonnegative(),
  ls: z.number().int().nonnegative(),
  x: z.boolean(),
});

/**
 * Zod schema for CandleGroupDTO
 */
export const CandleGroupDTOSchema = z.object({
  event: z.string(),
  typeData: z.string(),
  eventTime: z.number().int().positive(),
  asset: z.string(),
  symbol: z.string().min(1),
  contSymbol: z.string(),
  data: z.array(FootprintCandleDTOSchema),
});

// =============================================================================
// Gap Record Schemas
// =============================================================================

/**
 * Zod schema for GapRecordDTO (from database, has id)
 */
export const GapRecordDTOSchema = z.object({
  id: z.number().int().positive(),
  exchange: z.string().min(1),
  symbol: z.string().min(1),
  fromTradeId: z.number().int().nonnegative(),
  toTradeId: z.number().int().nonnegative(),
  gapSize: z.number().int().positive(),
  detectedAt: z.number().int().positive(),
  synced: z.boolean(),
  syncedAt: z.number().int().positive().nullable(),
});

/**
 * Zod schema for GapRecordInputDTO (for saving new gaps, no id)
 */
export const GapRecordInputDTOSchema = z.object({
  exchange: z.string().min(1),
  symbol: z.string().min(1),
  fromTradeId: z.number().int().nonnegative(),
  toTradeId: z.number().int().nonnegative(),
  gapSize: z.number().int().positive(),
  detectedAt: z.number().int().positive(),
});

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate QueueMessageDTO
 * @throws {z.ZodError} If validation fails
 */
export function validateQueueMessageDTO(data: unknown): QueueMessageDTO {
  return QueueMessageDTOSchema.parse(data) as QueueMessageDTO;
}

/**
 * Validate StateEntryDTO
 * @throws {z.ZodError} If validation fails
 */
export function validateStateEntryDTO(data: unknown): StateEntryDTO {
  return StateEntryDTOSchema.parse(data);
}

/**
 * Validate AggsDTO
 * @throws {z.ZodError} If validation fails
 */
export function validateAggsDTO(data: unknown): AggsDTO {
  return AggsDTOSchema.parse(data);
}

/**
 * Validate FootprintCandleDTO
 * @throws {z.ZodError} If validation fails
 */
export function validateFootprintCandleDTO(data: unknown): FootprintCandleDTO {
  return FootprintCandleDTOSchema.parse(data);
}

/**
 * Validate CandleGroupDTO
 * @throws {z.ZodError} If validation fails
 */
export function validateCandleGroupDTO(data: unknown): CandleGroupDTO {
  return CandleGroupDTOSchema.parse(data);
}

/**
 * Validate GapRecordDTO
 * @throws {z.ZodError} If validation fails
 */
export function validateGapRecordDTO(data: unknown): GapRecordDTO {
  return GapRecordDTOSchema.parse(data);
}

/**
 * Validate GapRecordInputDTO
 * @throws {z.ZodError} If validation fails
 */
export function validateGapRecordInputDTO(data: unknown): GapRecordInputDTO {
  return GapRecordInputDTOSchema.parse(data);
}

/**
 * Safe validation for AggsDTO (returns result object instead of throwing)
 */
export function safeValidateAggsDTO(
  data: unknown
): z.SafeParseReturnType<unknown, AggsDTO> {
  return AggsDTOSchema.safeParse(data);
}

/**
 * Safe validation for FootprintCandleDTO (returns result object instead of throwing)
 */
export function safeValidateFootprintCandleDTO(
  data: unknown
): z.SafeParseReturnType<unknown, FootprintCandleDTO> {
  return FootprintCandleDTOSchema.safeParse(data);
}

/**
 * Safe validation for CandleGroupDTO (returns result object instead of throwing)
 */
export function safeValidateCandleGroupDTO(
  data: unknown
): z.SafeParseReturnType<unknown, CandleGroupDTO> {
  return CandleGroupDTOSchema.safeParse(data);
}

/**
 * Safe validation for GapRecordDTO (returns result object instead of throwing)
 */
export function safeValidateGapRecordDTO(
  data: unknown
): z.SafeParseReturnType<unknown, GapRecordDTO> {
  return GapRecordDTOSchema.safeParse(data);
}

/**
 * Safe validation for GapRecordInputDTO (returns result object instead of throwing)
 */
export function safeValidateGapRecordInputDTO(
  data: unknown
): z.SafeParseReturnType<unknown, GapRecordInputDTO> {
  return GapRecordInputDTOSchema.safeParse(data);
}

/**
 * Safe validation for QueueMessageDTO (returns result object instead of throwing)
 */
export function safeValidateQueueMessageDTO(
  data: unknown
): z.SafeParseReturnType<unknown, QueueMessageDTO> {
  return QueueMessageDTOSchema.safeParse(data) as z.SafeParseReturnType<
    unknown,
    QueueMessageDTO
  >;
}

/**
 * Safe validation for StateEntryDTO (returns result object instead of throwing)
 */
export function safeValidateStateEntryDTO(
  data: unknown
): z.SafeParseReturnType<unknown, StateEntryDTO> {
  return StateEntryDTOSchema.safeParse(data);
}
