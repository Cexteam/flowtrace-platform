/**
 * Data Quality Domain Types
 *
 * Defines the domain entities and value objects for data quality management.
 * These types represent the core business concepts for trade gap checking.
 *
 */

/**
 * Trade gap - represents a period of missing trade data
 */
export interface TradeGap {
  /** Start timestamp of the gap (Unix ms) */
  from: number;
  /** End timestamp of the gap (Unix ms) */
  to: number;
  /** Duration of the gap in milliseconds */
  duration: number;
}

/**
 * Trade gap check request parameters
 */
export interface CheckTradeGapsRequest {
  /** Symbol to check (e.g., 'BTCUSDT') */
  symbol: string;
  /** Exchange name (e.g., 'binance') */
  exchange: string;
  /** Start time for the check (Unix ms) */
  fromTime: number;
  /** End time for the check (Unix ms) */
  toTime: number;
}

/**
 * Trade gap check response
 */
export interface CheckTradeGapsResponse {
  /** List of detected gaps */
  gaps: TradeGap[];
  /** Total number of gaps found */
  totalGaps: number;
  /** Total duration of all gaps in milliseconds */
  totalMissingDuration: number;
  /** Data completeness percentage (0-100) */
  dataCompleteness: number;
  /** Symbol that was checked */
  symbol: string;
  /** Exchange that was checked */
  exchange: string;
  /** Time range that was checked */
  fromTime: number;
  toTime: number;
  /** When the check was performed */
  checkedAt: Date;
}

/**
 * Gap sort options
 */
export type GapSortBy = 'duration' | 'time';
export type GapSortOrder = 'asc' | 'desc';

/**
 * Gap export format
 */
export type GapExportFormat = 'csv' | 'json';

/**
 * Gap severity level
 */
export type GapSeverity = 'critical' | 'warning' | 'info';

/**
 * Gap record - aggregated gap data for a symbol
 */
export interface GapRecord {
  /** Unique identifier */
  id: string;
  /** Symbol name */
  symbol: string;
  /** Exchange name */
  exchange: string;
  /** Number of gaps detected */
  gapCount: number;
  /** Timestamp of first gap (Unix ms) */
  firstGapTime: number;
  /** Timestamp of last gap (Unix ms) */
  lastGapTime: number;
  /** Total number of missing trades */
  totalMissingTrades: number;
  /** Severity level */
  severity: GapSeverity;
}

/**
 * Get gaps by exchange request parameters
 */
export interface GetGapsByExchangeRequest {
  /** Exchange to filter by */
  exchange: string;
  /** Page number (0-indexed) */
  page?: number;
  /** Page size */
  pageSize?: number;
  /** Search term for symbol name */
  search?: string;
  /** Filter by severity */
  severity?: 'all' | GapSeverity;
  /** Sort by column */
  sortBy?: 'gapCount' | 'totalMissingTrades' | 'lastGapTime' | 'symbol';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response for gaps by exchange
 */
export interface GetGapsByExchangeResponse {
  /** List of gap records */
  gaps: GapRecord[];
  /** Pagination info */
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}
