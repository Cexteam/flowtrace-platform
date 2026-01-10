/**
 * Hierarchical File Storage Types
 *
 * Type definitions for the hierarchical file storage system.
 * Supports separate storage for candle OHLCV data and footprint aggregations.
 */

// =============================================================================
// Partition Types
// =============================================================================

/**
 * Partition pattern based on timeframe
 * - day: 1m, 3m timeframes
 * - week: 5m, 15m timeframes
 * - month: 30m, 1h timeframes
 * - quarter: 2h, 4h timeframes
 * - year: 8h, 12h, 1d timeframes
 */
export type PartitionPattern = 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * Information about a partition (period file)
 */
export interface PartitionInfo {
  /** Partition pattern type */
  pattern: PartitionPattern;
  /** Period name (e.g., "2025-01-08", "2025-W02", "2025-01", "2025-Q1", "2025") */
  periodName: string;
  /** File name with extension (e.g., "2025-01-08.bin") */
  fileName: string;
  /** Period start timestamp (UTC) */
  startTimestamp: number;
  /** Period end timestamp (UTC) */
  endTimestamp: number;
}

// =============================================================================
// Data Types (Separated Storage)
// =============================================================================

/**
 * Candle OHLCV data (stored in candles/ directory)
 * Lightweight - no footprint aggregations
 * Used for chart rendering when footprint detail is not needed
 */
export interface CandleData {
  /** Open timestamp (milliseconds) */
  t: number;
  /** Close timestamp (milliseconds) */
  ct: number;
  /** Symbol (e.g., "BTCUSDT") */
  s: string;
  /** Interval/timeframe (e.g., "1m", "5m") */
  i: string;
  /** Open price */
  o: number;
  /** High price */
  h: number;
  /** Low price */
  l: number;
  /** Close price */
  c: number;
  /** Total volume */
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
  /** Delta (buy volume - sell volume) */
  d: number;
  /** Delta max */
  dMax: number;
  /** Delta min */
  dMin: number;
  /** Number of trades */
  n: number;
}

/**
 * Footprint aggregation data (stored in footprints/ directory)
 * Contains price-level volume breakdown
 * Used when detailed footprint analysis is needed
 */
export interface FootprintData {
  /** Open timestamp (key to join with candle) */
  t: number;
  /** Close timestamp */
  ct: number;
  /** Symbol */
  s: string;
  /** Interval/timeframe */
  i: string;
  /** Number of trades */
  n: number;
  /** Tick value */
  tv: number;
  /** Bin multiplier */
  bm: number;
  /** Price level aggregations */
  aggs: FootprintAgg[];
}

/**
 * Single price level aggregation in footprint
 */
export interface FootprintAgg {
  /** Tick price */
  tp: number;
  /** Volume at this price */
  v: number;
  /** Buy volume */
  bv: number;
  /** Sell volume */
  sv: number;
  /** Buy quote volume */
  bq: number;
  /** Sell quote volume */
  sq: number;
}

// =============================================================================
// Index and Metadata Types
// =============================================================================

/**
 * Index file data (.idx)
 * Contains metadata about a period file for quick lookups
 */
export interface IndexData {
  /** Period name (e.g., "2025-01-08") */
  period: string;
  /** Partition pattern */
  pattern: PartitionPattern;
  /** Number of candles in the period file */
  count: number;
  /** First candle timestamp */
  firstTimestamp: number;
  /** Last candle timestamp */
  lastTimestamp: number;
  /** Symbol */
  symbol: string;
  /** Interval/timeframe */
  interval: string;
  /** Optional CRC32 checksum of binary file */
  checksum?: string;
}

/**
 * Timeframe directory metadata (metadata.json)
 * Contains overview of all period files in a timeframe directory
 */
export interface TimeframeMetadata {
  /** Schema version */
  version: string;
  /** Data schema type */
  schema: 'candle' | 'footprint';
  /** Symbol */
  symbol: string;
  /** Interval/timeframe */
  interval: string;
  /** Partition pattern */
  pattern: PartitionPattern;
  /** Exchange name */
  exchange: string;
  /** Last updated timestamp (ISO string) */
  lastUpdated: string;
  /** Total number of period files */
  totalPeriods: number;
  /** Period range */
  periodRange: {
    /** First period name */
    from: string;
    /** Last period name */
    to: string;
  };
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Cloud storage provider type
 * Currently only GCS is supported
 */
export type CloudProvider = 'gcs';

/**
 * Cloud storage configuration (GCS only)
 */
export interface CloudStorageConfig {
  /** Cloud provider type (only 'gcs' supported) */
  provider: CloudProvider;
  /** GCS bucket name */
  bucketName: string;
  /** Optional path prefix within bucket */
  prefix?: string;
  /** GCS project ID */
  projectId?: string;
  /** Path to service account key file (optional, uses ADC if not provided) */
  keyFilePath?: string;

  /** Retry configuration for network errors */
  retryOptions?: {
    /** Maximum number of retries */
    maxRetries: number;
    /** Initial retry delay in milliseconds */
    retryDelayMs: number;
  };
}

/**
 * Hierarchical file storage configuration
 */
export interface HierarchicalStorageConfig {
  /** Base directory for all storage */
  baseDir: string;
  /** File storage location: 'local' or 'cloud' */
  fileStorageLocation: 'local' | 'cloud';
  /** Cloud-specific configuration (required if fileStorageLocation is 'cloud') */
  cloud?: CloudStorageConfig;
  /** Enable automatic metadata updates (default: true) */
  autoUpdateMetadata?: boolean;
}

// =============================================================================
// Period File Header Types
// =============================================================================

/**
 * Period file header structure (64 bytes fixed size)
 * Used for Append-Only strategy
 */
export interface PeriodFileHeader {
  /** Magic bytes: "FTCD" */
  magic: string;
  /** File format version */
  version: number;
  /** Record size (0 for variable size with FlatBuffer) */
  recordSize: number;
  /** Number of candles in file */
  count: number;
  /** First candle timestamp */
  firstTimestamp: number;
  /** Last candle timestamp */
  lastTimestamp: number;
  /** Symbol (max 16 chars) */
  symbol: string;
  /** Interval (max 8 chars) */
  interval: string;
}

/** Period file header size in bytes */
export const PERIOD_FILE_HEADER_SIZE = 64;

/** Magic bytes for period files */
export const PERIOD_FILE_MAGIC = 'FTCD';

/** Current period file format version */
export const PERIOD_FILE_VERSION = 1;
