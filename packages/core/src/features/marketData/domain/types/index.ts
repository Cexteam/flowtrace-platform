// Domain Layer - Core Business Types for MarketData Feature
// These types are the foundation of domain logic and should be independent
// of application and infrastructure concerns

// ✅ MARKET DATA DOMAIN ENTITIES
export interface BinanceSymbol {
  symbol: string;
  status: 'TRADING' | 'BREAK';
  baseAsset: string;
  quoteAsset: string;
  baseAssetPrecision: number;
  quoteAssetPrecision: number;
  baseCommissionPrecision: number;
  quoteCommissionPrecision: number;
  orderTypes: string[];
  icebergAllowed: boolean;
  ocoAllowed: boolean;
  quoteOrderQtyMarketAllowed: boolean;
  isSpotTradingAllowed: boolean;
  isMarginTradingAllowed: boolean;
  filters: Filter[];
  permissions: string[];
}

export interface Filter {
  filterType: string;
  minQty?: string;
  maxQty?: string;
  stepSize?: string;
  minNotional?: string;
  [key: string]: any;
}

// ✅ WEB SOCKET MARKET DATA ENTITIES
export interface MarketDataStream {
  stream: string;
  data: TradeMessage;
}

export interface TradeMessage {
  e: string;            // Event type ('trade')
  E: number;           // Event time
  T: number;           // Trade time
  s?: string;           // Symbol
  t?: number;           // Trade ID
  p?: string;           // Price
  q?: string;           // Quantity
  X?: string;           // Order type
  m?: boolean;          // Is buyer maker
}

// ✅ TRADING SYMBOLOGY ENTITY
export interface TradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  isActive: boolean;
  filters: Filter[];
}

// ✅ EXCHANGE MARKET DATA STATES
export interface ExchangeInfo {
  timezone: string;
  serverTime: number;
  rateLimits: RateLimit[];
  exchangeFilters: any[];
  symbols: BinanceSymbol[];
}

export interface RateLimit {
  rateLimitType: string;
  interval: string;
  intervalNum: number;
  limit: number;
}

// ✅ WEB SOCKET CONNECTION BUCKET
export interface StreamBucket {
  streams: string[];
  weight: number;
  maxStreams: number;
}

// ✅ MARKET STATUS
export interface MarketStatus {
  symbol: string;
  isOpen: boolean;
  lastPrice: string;
  priceChangePercent: string;
  eventTime: number;
}

// ✅ WEB SOCKET CONNECTION STATUS (For Port Interface)
export interface WebSocketConnectionStatus {
  isConnected: boolean;
  connectionUrl?: string;
  lastHeartbeat?: number;
  reconnectCount?: number;
  errorMessage?: string;
}
