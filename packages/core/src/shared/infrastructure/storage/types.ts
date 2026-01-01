/**
 * Storage Infrastructure Types
 *
 * Defines tick storage interface for dependency inversion.
 * Allows different storage implementations (local filesystem, memory).
 *
 */

/**
 * Tick data structure
 */
export interface Tick {
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Trade price */
  price: number;
  /** Signed quantity: positive = buy, negative = sell */
  quantity: number;
}

/**
 * Time index for efficient range queries
 */
export interface TimeIndex {
  symbol: string;
  startTime: number;
  endTime: number;
  tickCount: number;
  fileOffsets: Array<{
    timestamp: number;
    offset: number;
  }>;
}

/**
 * Tick storage interface for binary market data
 */
export interface ITickStorage {
  /**
   * Append ticks to storage for a symbol
   */
  appendTicks(symbol: string, ticks: Tick[]): Promise<void>;

  /**
   * Read ticks within a time range
   */
  readTicks(
    symbol: string,
    startTime: number,
    endTime: number
  ): Promise<Tick[]>;

  /**
   * Get the time index for a symbol
   */
  getTimeIndex(symbol: string): Promise<TimeIndex | null>;

  /**
   * Check if data exists for a symbol
   */
  hasData(symbol: string): Promise<boolean>;

  /**
   * Delete all data for a symbol
   */
  deleteSymbol(symbol: string): Promise<void>;

  /**
   * Close the storage
   */
  close(): Promise<void>;
}

/**
 * DI symbol for tick storage binding
 */
export const TICK_STORAGE_TOKEN = Symbol.for('ITickStorage');
