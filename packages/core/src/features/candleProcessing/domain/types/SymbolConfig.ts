/**
 * SymbolConfig Type
 *
 * Configuration for a trading symbol.
 * Used for initializing candle processing.
 */

/**
 * Symbol configuration for candle processing
 */
export interface SymbolConfig {
  /** Trading symbol (e.g., 'BTCUSDT') */
  symbol: string;

  /** Exchange name (e.g., 'binance') */
  exchange: string;

  /** Tick value for price binning (e.g., 0.1, 0.01) */
  tickValue: number;

  /** Last trade timestamp (for gap detection) */
  lastTradeTime?: number;

  /** Whether the symbol is active */
  isActive?: boolean;
}

/**
 * Create a default symbol config
 */
export function createDefaultSymbolConfig(
  symbol: string,
  exchange: string,
  tickValue: number = 0.1
): SymbolConfig {
  return {
    symbol,
    exchange,
    tickValue,
    isActive: true,
  };
}
