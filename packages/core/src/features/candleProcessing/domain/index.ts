/**
 * CandleProcessing Domain Layer Index
 *
 * Export all domain entities, services, value objects, and types.
 * This is the public API for the domain layer.
 *
 */

// Value Objects
export {
  Timeframe,
  TimeframeName,
  TIMEFRAME_SECONDS,
  TIMEFRAME_INTERVALS,
} from './value-objects/Timeframe.js';

export {
  TradeData,
  RawTrade,
  createTradeData,
  isBuyTrade,
  isSellTrade,
  getQuoteVolume,
  Trade,
  Trades,
} from './value-objects/TradeData.js';

// Entities
export { PriceBin, Aggs, mergeAggsArrays } from './entities/PriceBin.js';

export {
  FootprintCandle,
  FootprintCandleDTO,
} from './entities/FootprintCandle.js';

export { CandleGroup, CandleGroupDTO } from './entities/CandleGroup.js';

// Services
export {
  FootprintCalculator,
  calculateBinPrice,
  applyTradeToAggs,
  mergeAggs,
  applyTradeToCandle,
  calculateVolumeStats,
  calculateDelta,
  CalAggsFootprint,
  mergeFootprintAggs,
  calculateVolumeDelta,
  normalizePrice,
  validateTradePrice,
} from './services/FootprintCalculator.js';

export {
  TimeframeRollup,
  RollupResult,
  rollup,
  calculateOpentime,
  calculateCheckTime,
} from './services/TimeframeRollup.js';

export {
  CandleCompletionDetector,
  hasTimeframeCrossed,
  shouldComplete,
  calculateCompletionTime,
  getPeriodStart,
  getPeriodEnd,
  isSamePeriod,
} from './services/CandleCompletionDetector.js';

// Types
export { SymbolConfig, createDefaultSymbolConfig } from './types/index.js';

// Additional types from tradingAlgorithms (for backward compatibility)
// Note: These types need to be defined locally since tradingAlgorithms was removed
export type Candle = {
  e?: string; // Event type
  ex?: string; // Exchange
  s?: string; // Symbol
  i?: string; // Interval
  t?: number; // Timestamp (open)
  o?: number; // Open
  h?: number; // High
  l?: number; // Low
  c?: number; // Close
  v?: number; // Volume
  aggs?: import('./entities/PriceBin.js').Aggs[]; // Aggregation details
};

export type CandlesOfSymbol = {
  symbol?: string;
  data?: Candle[];
};

export type TradingPriceBin = {
  binPrice: number;
  totalVol: number;
  buyVol: number;
  sellVol: number;
  delta: number;
};

export type FootprintBuffer = {
  openTime: number;
  bins: Map<number, TradingPriceBin>;
};
