/**
 * Exchange Types
 *
 * Simple type definitions for supported exchanges.
 * Used by ExchangeConfigRepository and related components.
 */

/**
 * Supported exchanges
 */
export type Exchange = 'binance' | 'bybit' | 'okx';

/**
 * Helper to validate if a string is a valid exchange
 */
export function isValidExchange(value: string): value is Exchange {
  return ['binance', 'bybit', 'okx'].includes(value);
}

/**
 * Helper to get exchange display name
 */
export function getExchangeDisplayName(exchange: Exchange): string {
  const names: Record<Exchange, string> = {
    binance: 'Binance',
    bybit: 'Bybit',
    okx: 'OKX',
  };
  return names[exchange];
}
