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
export { CalAggsFootprint, mergeAggs } from './services/FootprintCalculator.js';

export {
  RollupResult,
  rollup,
  UpdatedGroupCandles,
} from './services/TimeframeRollup.js';

export {
  shouldComplete,
  calculateCompletionTime,
} from './services/CandleCompletionDetector.js';

// Types
export { SymbolConfig, createDefaultSymbolConfig } from './types/index.js';
