/**
 * CandleReaderPort
 * Read-only port for candle storage operations.
 * This is a subset of CandleStoragePort, exposing only read operations
 * for use by external packages (e.g., @flowtrace/api).
 */

/**
 * Aggregation data for footprint candles
 */
export interface CandleAggregation {
  /** Tick price */
  tp: number;
  /** Volume */
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

/**
 * FootprintCandleResult - Result type for candle queries
 * This is a minimal interface that matches the data stored in the database.
 * It avoids dependency on @flowtrace/core for consumers who only need read access.
 */
export interface FootprintCandleResult {
  /** Event type */
  e: string;
  /** Exchange */
  ex: string;
  /** Symbol */
  s: string;
  /** Interval/timeframe */
  i: string;
  /** Open time */
  t: number;
  /** Close time */
  ct: number;
  /** Open price */
  o: number;
  /** High price */
  h: number;
  /** Low price */
  l: number;
  /** Close price */
  c: number;
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
  /** Delta (buy - sell volume) */
  d: number;
  /** Max delta */
  dMax: number;
  /** Min delta */
  dMin: number;
  /** Number of trades */
  n: number;
  /** Tick value */
  tv: number;
  /** First trade id */
  f: number;
  /** Last trade id */
  ls: number;
  /** Is closed */
  x: boolean;
  /** Footprint aggregations */
  aggs: CandleAggregation[];
}

export interface CandleReaderPort {
  /**
   * Find candles by symbol, exchange, and timeframe
   *
   * @param symbol - Trading symbol
   * @param exchange - Exchange name
   * @param timeframe - Timeframe (e.g., '1m', '5m')
   * @param options - Query options
   * @returns Array of FootprintCandleResult
   */
  findBySymbol(
    symbol: string,
    exchange: string,
    timeframe: string,
    options?: {
      startTime?: number;
      endTime?: number;
      limit?: number;
    }
  ): Promise<FootprintCandleResult[]>;

  /**
   * Find the latest candle for a symbol
   *
   * @param symbol - Trading symbol
   * @param exchange - Exchange name
   * @param timeframe - Timeframe (e.g., '1m', '5m')
   * @returns Latest FootprintCandleResult or null if not found
   */
  findLatest(
    symbol: string,
    exchange: string,
    timeframe: string
  ): Promise<FootprintCandleResult | null>;

  /**
   * Count candles for a symbol
   *
   * @param symbol - Trading symbol
   * @param exchange - Exchange name
   * @param timeframe - Timeframe (e.g., '1m', '5m')
   * @param options - Query options
   * @returns Number of candles
   */
  count(
    symbol: string,
    exchange: string,
    timeframe: string,
    options?: {
      startTime?: number;
      endTime?: number;
    }
  ): Promise<number>;

  /**
   * Close the reader and release resources
   */
  close(): Promise<void>;
}
