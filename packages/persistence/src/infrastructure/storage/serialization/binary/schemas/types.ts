/**
 * Binary Storage Types
 * TypeScript interfaces for binary serialization of market data.
 * Used for efficient binary storage of trades and candles.
 */

// ============================================================================
// Trade Types
// ============================================================================

/**
 * Binary trade record
 * Matches the Trade table in FlatBuffer schema (trade.fbs)
 */
export interface BinaryTrade {
  id: bigint; // id in FlatBuffer (ulong)
  price: number; // p in FlatBuffer
  quantity: number; // q in FlatBuffer
  quoteQuantity: number; // qq in FlatBuffer
  timestamp: bigint; // t in FlatBuffer (ulong)
  isBuyerMaker: boolean; // m in FlatBuffer
  // Legacy fields not in FlatBuffer (for backward compatibility)
  symbol?: string;
  exchange?: string;
  tradeId?: number;
  createdAt?: number;
}

/**
 * Block of trades for batch storage
 */
export interface TradeBlock {
  symbol: string;
  exchange: string;
  startTime: number;
  endTime: number;
  trades: BinaryTrade[];
}

/**
 * Trade file header
 */
export interface TradeFile {
  version: number;
  symbol: string;
  exchange: string;
  createdAt: number;
  blocks: TradeBlock[];
}

// ============================================================================
// Candle Types
// ============================================================================

/**
 * Price bin for footprint data (aggregations)
 * Matches the Aggs table in FlatBuffer schema (aggs.fbs)
 */
export interface BinaryAggs {
  tp: number; // tick price
  v: number; // volume
  bv: number; // buy volume
  sv: number; // sell volume
  bq: number; // buy quote
  sq: number; // sell quote
}

/**
 * Legacy alias for backward compatibility
 * @deprecated Use BinaryAggs instead
 */
export interface BinaryPriceBin {
  price: number; // tp in FlatBuffer
  volume?: number; // v in FlatBuffer
  buyVolume: number; // bv in FlatBuffer
  sellVolume: number; // sv in FlatBuffer
  buyQuote?: number; // bq in FlatBuffer
  sellQuote?: number; // sq in FlatBuffer
  buyCount?: number; // Not in FlatBuffer (legacy)
  sellCount?: number; // Not in FlatBuffer (legacy)
  delta?: number; // Calculated: bv - sv
}

/**
 * Binary footprint candle
 * Matches the Candle table in FlatBuffer schema (candle.fbs)
 * This interface is used for the intermediate representation
 * before/after FlatBuffer serialization.
 * Note: This interface supports both FlatBuffer field names (short) and
 * legacy field names (descriptive) for backward compatibility.
 */
export interface BinaryCandle {
  // Composite ID (legacy, not in FlatBuffer)
  id: string;

  // Core identifiers (legacy names are primary for backward compatibility)
  symbol: string; // s in FlatBuffer
  exchange: string; // ex in FlatBuffer
  timeframe: string; // i in FlatBuffer

  // Time fields (legacy names are primary)
  openTime: number; // t in FlatBuffer
  closeTime: number; // ct in FlatBuffer

  // OHLCV (legacy names are primary)
  open: number; // o in FlatBuffer
  high: number; // h in FlatBuffer
  low: number; // l in FlatBuffer
  close: number; // c in FlatBuffer
  volume: number; // v in FlatBuffer

  // Buy/Sell volumes (legacy names are primary)
  buyVolume: number; // bv in FlatBuffer
  sellVolume: number; // sv in FlatBuffer

  // Quote volumes (legacy names are primary)
  quoteVolume: number; // q in FlatBuffer
  buyQuoteVolume: number; // bq in FlatBuffer
  sellQuoteVolume: number; // sq in FlatBuffer

  // Trade count (legacy name is primary)
  tradeCount: number; // n in FlatBuffer

  // Delta (legacy names are primary)
  delta: number; // d in FlatBuffer
  deltaMax: number; // dMax in FlatBuffer
  deltaMin: number; // dMin in FlatBuffer

  // Other fields (legacy names are primary)
  tickValue: number; // tv in FlatBuffer
  firstTradeId: number; // f in FlatBuffer
  lastTradeId: number; // ls in FlatBuffer
  isComplete: boolean; // x in FlatBuffer

  // Footprint data (can use either BinaryAggs or BinaryPriceBin)
  aggs: (BinaryAggs | BinaryPriceBin)[]; // aggs vector in FlatBuffer

  // Metadata (not in FlatBuffer)
  createdAt: number;
  updatedAt: number;

  // FlatBuffer field names (optional for backward compatibility)
  e?: string; // event type
  tz?: string; // timezone
  ex?: string; // exchange (alias for 'exchange')
  a?: string; // asset
  s?: string; // symbol (alias for 'symbol')
  s1?: string; // symbol alternate
  s2?: string; // symbol alternate 2
  i?: string; // interval/timeframe (alias for 'timeframe')
  vi?: bigint; // interval in seconds (int64)
  t?: bigint; // open timestamp (alias for 'openTime')
  ct?: bigint; // close timestamp (alias for 'closeTime')
  df?: bigint; // diff (int64)
  o?: number; // open (alias for 'open')
  h?: number; // high (alias for 'high')
  l?: number; // low (alias for 'low')
  c?: number; // close (alias for 'close')
  v?: number; // volume (alias for 'volume')
  bv?: number; // buy volume (alias for 'buyVolume')
  sv?: number; // sell volume (alias for 'sellVolume')
  q?: number; // quote volume (alias for 'quoteVolume')
  bq?: number; // buy quote volume (alias for 'buyQuoteVolume')
  sq?: number; // sell quote volume (alias for 'sellQuoteVolume')
  d?: number; // delta (alias for 'delta')
  dMax?: number; // delta max (alias for 'deltaMax')
  dMin?: number; // delta min (alias for 'deltaMin')
  n?: bigint; // trade count (alias for 'tradeCount')
  tv?: number; // tick value (alias for 'tickValue')
  f?: number; // first trade id (alias for 'firstTradeId')
  ls?: number; // last price (alias for 'lastTradeId')
  x?: boolean; // is closed/complete (alias for 'isComplete')
}

/**
 * Block of candles for batch storage
 */
export interface CandleBlock {
  symbol: string;
  exchange: string;
  timeframe: string;
  startTime: number;
  endTime: number;
  candles: BinaryCandle[];
}

/**
 * Candle file header
 */
export interface CandleFile {
  version: number;
  symbol: string;
  exchange: string;
  timeframe: string;
  createdAt: number;
  blocks: CandleBlock[];
}

// ============================================================================
// Storage Configuration
// ============================================================================

/**
 * Binary storage configuration
 */
export interface BinaryStorageConfig {
  /** Base directory for binary files */
  baseDir: string;

  /** Maximum trades per block */
  maxTradesPerBlock: number;

  /** Maximum candles per block */
  maxCandlesPerBlock: number;

  /** Enable compression */
  compression: boolean;
}

/**
 * Default binary storage configuration
 */
export const DEFAULT_BINARY_STORAGE_CONFIG: BinaryStorageConfig = {
  baseDir: '.flowtrace/data',
  maxTradesPerBlock: 10000,
  maxCandlesPerBlock: 1000,
  compression: true,
};
