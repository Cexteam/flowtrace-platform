/**
 * Shared DTO definitions for IPC communication
 *
 * These DTOs define the data contracts between packages communicating via IPC.
 * All cross-package communication types are centralized here as the single source of truth.
 *
 */

// =============================================================================
// Queue Message DTOs
// =============================================================================

/**
 * Queue message structure for SQLite message queue persistence
 *
 * Note: This has the same structure as IPCMessage (in types.ts) because
 * queue messages ARE IPC messages that are persisted to SQLite as fallback.
 * We keep them separate because:
 * - IPCMessage = Protocol-level message wrapper (types.ts)
 * - QueueMessageDTO = Data structure for SQLite storage (dto.ts)
 *
 * They are intentionally identical but serve different purposes.
 */
export interface QueueMessageDTO {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
}

// =============================================================================
// State Persistence DTOs
// =============================================================================

/**
 * State entry DTO (from database)
 * Represents a persisted CandleGroup state
 */
export interface StateEntryDTO {
  exchange: string;
  symbol: string;
  stateJson: string;
  updatedAt?: number;
}

// =============================================================================
// Candle DTOs
// =============================================================================

/**
 * Price bin aggregation data for footprint analysis
 * Represents aggregated volume at a specific price level
 */
export interface AggsDTO {
  /** Tick price (binned price level) */
  tp: number;
  /** Buy volume */
  bv: number;
  /** Sell volume */
  sv: number;
  /** Total volume */
  v: number;
  /** Buy quote volume (optional) */
  bq?: number;
  /** Sell quote volume (optional) */
  sq?: number;
  /** Total quote volume (optional) */
  q?: number;
}

/**
 * FootprintCandle DTO for serialization
 * Represents a candle with volume profile data
 *
 */
export interface FootprintCandleDTO {
  /** Event type */
  e: string;
  /** Timezone */
  tz: string;
  /** Exchange */
  ex: string;
  /** Asset */
  a: string;
  /** Symbol */
  s: string;
  /** Interval (timeframe name) */
  i: string;
  /** Interval in seconds */
  vi: number;
  /** Open time (timestamp) */
  t: number;
  /** Open price */
  o: number;
  /** High price */
  h: number;
  /** Low price */
  l: number;
  /** Close price */
  c: number;
  /** Close time (timestamp) */
  ct: number;
  /** Volume */
  v: number;
  /** Buy volume */
  bv: number;
  /** Sell volume */
  sv: number;
  /** Quote volume */
  q: number;
  /** Buy quote volume */
  bq: number;
  /** Sell quote volume */
  sq: number;
  /** Number of trades */
  n: number;
  /** Delta (buy - sell volume) */
  d: number;
  /** Max delta */
  dMax: number;
  /** Min delta */
  dMin: number;
  /** Tick value for binning */
  tv: number;
  /** Price bins (footprint data) */
  aggs: AggsDTO[];
  /** First trade ID */
  f: number;
  /** Last trade ID */
  ls: number;
  /** Is complete */
  x: boolean;
}

/**
 * CandleGroup DTO for serialization
 * Represents a group of candles for a symbol across all timeframes
 *
 */
export interface CandleGroupDTO {
  /** Event type */
  event: string;
  /** Data type */
  typeData: string;
  /** Event time (timestamp) */
  eventTime: number;
  /** Asset */
  asset: string;
  /** Symbol */
  symbol: string;
  /** Continuous symbol */
  contSymbol: string;
  /** Array of candles for all timeframes */
  data: FootprintCandleDTO[];
}

// =============================================================================
// Gap Record DTOs
// =============================================================================

/**
 * Gap record DTO for persistence
 * Represents a detected gap in trade sequence
 *
 */
export interface GapRecordDTO {
  /** Record ID (assigned by database) */
  id: number;
  /** Exchange name (e.g., 'binance', 'bybit') */
  exchange: string;
  /** Symbol */
  symbol: string;
  /** First missing trade ID */
  fromTradeId: number;
  /** Last missing trade ID */
  toTradeId: number;
  /** Number of missing trades */
  gapSize: number;
  /** Detection timestamp */
  detectedAt: number;
  /** Whether gap has been synced */
  synced: boolean;
  /** Sync timestamp (optional) */
  syncedAt: number | null;
}

/**
 * Gap record input DTO (for saving new gaps)
 * Excludes id, synced, and syncedAt which are set by the system
 */
export interface GapRecordInputDTO {
  /** Exchange name (e.g., 'binance', 'bybit') */
  exchange: string;
  /** Symbol */
  symbol: string;
  /** First missing trade ID */
  fromTradeId: number;
  /** Last missing trade ID */
  toTradeId: number;
  /** Number of missing trades */
  gapSize: number;
  /** Detection timestamp */
  detectedAt: number;
}

/**
 * Options for loading gap records
 */
export interface GapLoadOptionsDTO {
  exchange?: string;
  symbol?: string;
  syncedOnly?: boolean;
}
