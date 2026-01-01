/**
 * Trade Entity - Domain Model
 *
 * Represents a single trade from an exchange.
 * Used for storing and retrieving historical trade data.
 */

export interface Trade {
  readonly id: string;
  readonly symbol: string;
  readonly exchange: string;
  readonly price: number;
  readonly quantity: number;
  readonly quoteQuantity: number;
  readonly timestamp: number;
  readonly isBuyerMaker: boolean;
  readonly tradeId: number;
  readonly createdAt: Date;
}

/**
 * Create a new Trade entity
 */
export function createTrade(params: {
  id: string;
  symbol: string;
  exchange: string;
  price: number;
  quantity: number;
  timestamp: number;
  isBuyerMaker: boolean;
  tradeId: number;
  createdAt?: Date;
}): Trade {
  return {
    id: params.id,
    symbol: params.symbol,
    exchange: params.exchange,
    price: params.price,
    quantity: params.quantity,
    quoteQuantity: params.price * params.quantity,
    timestamp: params.timestamp,
    isBuyerMaker: params.isBuyerMaker,
    tradeId: params.tradeId,
    createdAt: params.createdAt || new Date(),
  };
}

/**
 * Check if trade is a buy order
 */
export function isBuyTrade(trade: Trade): boolean {
  return !trade.isBuyerMaker;
}

/**
 * Check if trade is a sell order
 */
export function isSellTrade(trade: Trade): boolean {
  return trade.isBuyerMaker;
}
