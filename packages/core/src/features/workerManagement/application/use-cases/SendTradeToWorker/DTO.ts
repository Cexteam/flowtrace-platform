/**
 * SendTradeToWorker Use Case DTOs
 *
 * Data transfer objects for the SendTradeToWorker use case.
 */

/**
 * Trade data to send to worker
 */
export interface TradeData {
  /** Trading symbol */
  symbol: string;
  /** Trade price */
  price: string;
  /** Trade quantity */
  quantity: string;
  /** Trade timestamp */
  timestamp: number;
  /** Whether buyer is maker (true = sell, false = buy) */
  isBuyerMaker: boolean;
  /** Optional trade ID */
  tradeId?: number;
}

/**
 * Request to send trades to a worker
 */
export interface SendTradeToWorkerRequest {
  /** Trading symbol */
  symbol: string;
  /** Array of trades to process */
  trades: TradeData[];
  /** Optional configuration */
  config?: {
    /** Tick value for footprint calculations */
    tickValue?: number;
    /** Exchange name */
    exchange?: string;
    /** Whether this is a new symbol */
    isNewSymbol?: boolean;
  };
  /** Optional processing options */
  options?: {
    /** Priority level */
    priority?: 'urgent' | 'normal';
    /** Batch identifier */
    batchId?: string;
    /** Skip validation */
    skipValidation?: boolean;
  };
}

/**
 * Result of sending trades to worker
 */
export interface SendTradeToWorkerResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Trading symbol */
  symbol: string;
  /** Worker that processed the trades */
  workerId: string;
  /** Number of trades processed */
  processedTrades: number;
  /** Number of events published */
  eventsPublished: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Error message if failed */
  error?: string;
  /** Additional metadata */
  metadata?: {
    candlesUpdated: number;
    timeframeRollups: string[];
  };
}
