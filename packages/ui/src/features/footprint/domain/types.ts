/**
 * Footprint Domain Types
 *
 * Defines the domain entities and value objects for footprint/candle management.
 * These types represent the core business concepts for candle and footprint data.
 *
 * Requirements: 12.1-14.3
 */

/**
 * Timeframe options for candle data
 */
export type Timeframe =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '8h'
  | '12h'
  | '1d';

/**
 * All available timeframe options
 */
export const TIMEFRAME_OPTIONS: { value: Timeframe; label: string }[] = [
  { value: '1m', label: '1 minute' },
  { value: '3m', label: '3 minutes' },
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '2h', label: '2 hours' },
  { value: '4h', label: '4 hours' },
  { value: '8h', label: '8 hours' },
  { value: '12h', label: '12 hours' },
  { value: '1d', label: '1 day' },
];

/**
 * Candle data structure
 */
export interface Candle {
  /** Unique identifier */
  id: string;
  /** Exchange name */
  exchange: string;
  /** Symbol name */
  symbol: string;
  /** Timeframe */
  timeframe: string;
  /** Open time (Unix ms) */
  openTime: number;
  /** Close time (Unix ms) */
  closeTime: number;
  /** Open price */
  open: number;
  /** High price */
  high: number;
  /** Low price */
  low: number;
  /** Close price */
  close: number;
  /** Total volume */
  volume: number;
  /** Buy volume */
  buyVolume: number;
  /** Sell volume */
  sellVolume: number;
  /** Delta (buyVolume - sellVolume) */
  delta: number;
  /** Number of trades */
  tradeCount: number;
}

/**
 * Price level for footprint data
 */
export interface PriceLevel {
  /** Price at this level */
  price: number;
  /** Total volume at this level */
  volume: number;
  /** Buy volume at this level */
  buyVolume: number;
  /** Sell volume at this level */
  sellVolume: number;
  /** Delta at this level */
  delta: number;
}

/**
 * Candle detail with footprint data
 */
export interface CandleDetail extends Candle {
  /** Price levels with volume distribution */
  priceLevels: PriceLevel[];
}

/**
 * Request parameters for getting completed candles
 */
export interface GetCompletedCandlesRequest {
  /** Exchange to filter by */
  exchange: string;
  /** Symbol to filter by */
  symbol: string;
  /** Timeframe */
  timeframe: string;
  /** Page number (0-indexed) */
  page?: number;
  /** Page size */
  pageSize?: number;
  /** Start time filter (Unix ms) */
  startTime?: number;
  /** End time filter (Unix ms) */
  endTime?: number;
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response for completed candles
 */
export interface GetCompletedCandlesResponse {
  /** List of candles */
  candles: Candle[];
  /** Pagination info */
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

/**
 * Request parameters for getting candle detail
 */
export interface GetCandleDetailRequest {
  /** Exchange name */
  exchange: string;
  /** Symbol name */
  symbol: string;
  /** Timeframe */
  timeframe: string;
  /** Open time of the candle (Unix ms) */
  openTime: number;
}

/**
 * Footprint selector state
 */
export interface FootprintSelectorState {
  /** Selected exchange */
  exchange: string | null;
  /** Selected symbol */
  symbol: string | null;
  /** Selected timeframe */
  timeframe: Timeframe;
  /** Start date for date range */
  startDate: Date | null;
  /** End date for date range */
  endDate: Date | null;
}
