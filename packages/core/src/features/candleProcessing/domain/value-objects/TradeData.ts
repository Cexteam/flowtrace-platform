/**
 * TradeData Value Object
 *
 * Represents a single trade with price, quantity, and direction.
 * Immutable value object for trade processing.
 *
 */

/**
 * Raw trade data from exchange (Binance format)
 */
export interface RawTrade {
  e?: string; // Event type
  E?: number; // Event time
  T?: number; // Trade time
  s?: string; // Symbol
  t?: number; // Trade ID
  p?: string; // Price (string from exchange)
  q?: string; // Quantity (string from exchange)
  X?: string; // Buyer order ID
  m?: boolean; // Is buyer maker? (true = sell, false = buy)
}

/**
 * TradeData value object
 * Immutable representation of a trade
 */
export interface TradeData {
  readonly symbol: string;
  readonly price: number;
  readonly quantity: number;
  readonly timestamp: number;
  readonly isBuyerMaker: boolean; // true = sell (buyer is maker), false = buy (buyer is taker)
  readonly tradeId?: number;
  readonly tradeType?: string; // Trade type (e.g., 'MARKET', 'LIMIT')
}

/**
 * Create TradeData from raw exchange trade
 * Factory method to convert exchange format to domain format
 *
 * Note: Allows p=0, q=0 trades (e.g., X=NA metadata trades from Binance)
 * These are filtered in ProcessTradeUseCase but still need lastTradeId tracking
 */
export function createTradeData(raw: RawTrade): TradeData {
  const price = raw.p ? parseFloat(raw.p) : 0;
  const quantity = raw.q ? parseFloat(raw.q) : 0;

  if (isNaN(price) || isNaN(quantity)) {
    throw new Error(
      `Invalid trade: price or quantity is not a valid number. Raw: p=${raw.p}, q=${raw.q}, t=${raw.t}, X=${raw.X}`
    );
  }

  return {
    symbol: raw.s || '',
    price,
    quantity,
    timestamp: raw.T || raw.E || Date.now(),
    isBuyerMaker: raw.m ?? false,
    tradeId: raw.t,
    tradeType: raw.X,
  };
}

/**
 * Check if trade is a buy order
 * Buy = buyer is taker (isBuyerMaker = false)
 */
export function isBuyTrade(trade: TradeData): boolean {
  return !trade.isBuyerMaker;
}

/**
 * Check if trade is a sell order
 * Sell = buyer is maker (isBuyerMaker = true)
 */
export function isSellTrade(trade: TradeData): boolean {
  return trade.isBuyerMaker;
}

/**
 * Calculate quote volume (price * quantity)
 */
export function getQuoteVolume(trade: TradeData): number {
  return trade.price * trade.quantity;
}

// Backward compatibility aliases for tradingAlgorithms
export type Trade = RawTrade;
export type Trades = RawTrade[];
