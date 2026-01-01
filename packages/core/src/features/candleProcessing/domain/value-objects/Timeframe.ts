/**
 * Timeframe Value Object
 *
 * Represents a trading timeframe (1s, 1m, 5m, etc.)
 * Immutable value object with milliseconds/seconds conversion.
 *
 */

/**
 * Timeframe configuration mapping name to milliseconds
 * Ported from TIMEFRAME_SECONDS in existing code
 */
const TIMEFRAME_CONFIG: Record<string, number> = {
  '1s': 1000,
  '1m': 60000,
  '3m': 180000,
  '5m': 300000,
  '15m': 900000,
  '30m': 1800000,
  '1h': 3600000,
  '2h': 7200000,
  '4h': 14400000,
  '8h': 28800000,
  '12h': 43200000,
  '1d': 86400000,
};

/**
 * Timeframe value object
 * Immutable representation of a trading timeframe
 */
export class Timeframe {
  private readonly _name: string;
  private readonly _milliseconds: number;

  constructor(name: string) {
    if (!TIMEFRAME_CONFIG[name]) {
      throw new Error(
        `Invalid timeframe: ${name}. Valid timeframes: ${Object.keys(
          TIMEFRAME_CONFIG
        ).join(', ')}`
      );
    }
    this._name = name;
    this._milliseconds = TIMEFRAME_CONFIG[name];
  }

  /**
   * Get the timeframe name (e.g., '1m', '5m')
   */
  get name(): string {
    return this._name;
  }

  /**
   * Get the timeframe duration in milliseconds
   */
  get milliseconds(): number {
    return this._milliseconds;
  }

  /**
   * Get the timeframe duration in seconds
   */
  get seconds(): number {
    return this._milliseconds / 1000;
  }

  /**
   * Check if this timeframe equals another
   */
  equals(other: Timeframe): boolean {
    return this._name === other._name;
  }

  /**
   * Get all available timeframes
   */
  static all(): Timeframe[] {
    return Object.keys(TIMEFRAME_CONFIG).map((name) => new Timeframe(name));
  }

  /**
   * Get all timeframe names
   */
  static allNames(): string[] {
    return Object.keys(TIMEFRAME_CONFIG);
  }

  /**
   * Check if a timeframe name is valid
   */
  static isValid(name: string): boolean {
    return name in TIMEFRAME_CONFIG;
  }

  /**
   * Get the 1-second timeframe (base timeframe for trade processing)
   */
  static oneSecond(): Timeframe {
    return new Timeframe('1s');
  }

  /**
   * Get the 1-minute timeframe
   */
  static oneMinute(): Timeframe {
    return new Timeframe('1m');
  }

  toString(): string {
    return this._name;
  }
}

/**
 * Type for timeframe name literals
 */
export type TimeframeName = keyof typeof TIMEFRAME_CONFIG;

/**
 * Export timeframe seconds mapping for backward compatibility
 */
export const TIMEFRAME_SECONDS = Object.fromEntries(
  Object.entries(TIMEFRAME_CONFIG).map(([name, ms]) => [name, ms / 1000])
) as Record<TimeframeName, number>;
/**
 * Export timeframe intervals mapping for backward compatibility
 * Migrated from tradingAlgorithms
 */
export const TIMEFRAME_INTERVALS = TIMEFRAME_CONFIG;
