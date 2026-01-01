/**
 * Exchange Metadata Types
 *
 * Discriminated union types for exchange-specific metadata.
 * Each exchange has its own metadata structure.
 */

// Supported exchanges
export type Exchange = 'binance' | 'bybit' | 'okx' | 'kraken' | 'coinbase';

// Base metadata interface
interface BaseExchangeMetadata {
  exchange: Exchange;
  lastSeenAt: Date;
}

// Binance-specific metadata
export interface BinanceMetadata extends BaseExchangeMetadata {
  exchange: 'binance';
  status: 'TRADING' | 'BREAK' | 'HALT';
  contractType?: 'PERPETUAL' | 'CURRENT_QUARTER' | 'NEXT_QUARTER';
  baseAsset?: string;
  quoteAsset?: string;
  marginAsset?: string;
}

// Bybit-specific metadata
export interface BybitMetadata extends BaseExchangeMetadata {
  exchange: 'bybit';
  status: 'Trading' | 'Closed' | 'Settling';
  contractType?: 'LinearPerpetual' | 'InversePerpetual' | 'LinearFutures';
  baseCoin?: string;
  quoteCoin?: string;
  settleCoin?: string;
}

// OKX-specific metadata
export interface OKXMetadata extends BaseExchangeMetadata {
  exchange: 'okx';
  state: 'live' | 'suspend' | 'expired' | 'preopen';
  instType?: 'SWAP' | 'FUTURES' | 'OPTION';
  baseCcy?: string;
  quoteCcy?: string;
  settleCcy?: string;
}

// Kraken-specific metadata
export interface KrakenMetadata extends BaseExchangeMetadata {
  exchange: 'kraken';
  status: 'online' | 'cancel_only' | 'post_only' | 'limit_only' | 'reduce_only';
  type?: 'perpetual' | 'futures';
  base?: string;
  quote?: string;
}

// Coinbase-specific metadata
export interface CoinbaseMetadata extends BaseExchangeMetadata {
  exchange: 'coinbase';
  status: 'online' | 'offline' | 'delisted';
  productType?: 'SPOT' | 'FUTURE';
  baseCurrency?: string;
  quoteCurrency?: string;
}

// Discriminated union of all exchange metadata
export type ExchangeMetadata =
  | BinanceMetadata
  | BybitMetadata
  | OKXMetadata
  | KrakenMetadata
  | CoinbaseMetadata;

// Type guards
export function isBinanceMetadata(
  metadata: ExchangeMetadata
): metadata is BinanceMetadata {
  return metadata.exchange === 'binance';
}

export function isBybitMetadata(
  metadata: ExchangeMetadata
): metadata is BybitMetadata {
  return metadata.exchange === 'bybit';
}

export function isOKXMetadata(
  metadata: ExchangeMetadata
): metadata is OKXMetadata {
  return metadata.exchange === 'okx';
}

export function isKrakenMetadata(
  metadata: ExchangeMetadata
): metadata is KrakenMetadata {
  return metadata.exchange === 'kraken';
}

export function isCoinbaseMetadata(
  metadata: ExchangeMetadata
): metadata is CoinbaseMetadata {
  return metadata.exchange === 'coinbase';
}

// Helper to check if symbol is active on exchange
export function isSymbolActiveOnExchange(metadata: ExchangeMetadata): boolean {
  switch (metadata.exchange) {
    case 'binance':
      return metadata.status === 'TRADING';
    case 'bybit':
      return metadata.status === 'Trading';
    case 'okx':
      return metadata.state === 'live';
    case 'kraken':
      return metadata.status === 'online';
    case 'coinbase':
      return metadata.status === 'online';
    default:
      return false;
  }
}

// Helper to get exchange display name
export function getExchangeDisplayName(exchange: Exchange): string {
  const names: Record<Exchange, string> = {
    binance: 'Binance',
    bybit: 'Bybit',
    okx: 'OKX',
    kraken: 'Kraken',
    coinbase: 'Coinbase',
  };
  return names[exchange];
}

// Helper to validate metadata structure
export function validateExchangeMetadata(
  exchange: Exchange,
  metadata: unknown
): metadata is ExchangeMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }

  const meta = metadata as any;

  // Check common fields
  if (meta.exchange !== exchange || !meta.lastSeenAt) {
    return false;
  }

  // Exchange-specific validation
  switch (exchange) {
    case 'binance':
      return ['TRADING', 'BREAK', 'HALT'].includes(meta.status);
    case 'bybit':
      return ['Trading', 'Closed', 'Settling'].includes(meta.status);
    case 'okx':
      return ['live', 'suspend', 'expired', 'preopen'].includes(meta.state);
    case 'kraken':
      return [
        'online',
        'cancel_only',
        'post_only',
        'limit_only',
        'reduce_only',
      ].includes(meta.status);
    case 'coinbase':
      return ['online', 'offline', 'delisted'].includes(meta.status);
    default:
      return false;
  }
}
