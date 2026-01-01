/**
 * FootprintCalculator Service
 *
 * Pure function service for footprint calculations.
 * Calculates price bins and volume aggregations.
 * Ported from cm_sync_candle/src/exchange_crypto/utils/conf_candle.ts
 *
 */

import _ from 'lodash';
import { TradeData, RawTrade } from '../value-objects/TradeData.js';
import { Aggs } from '../entities/PriceBin.js';
import { FootprintCandle } from '../entities/FootprintCandle.js';

/**
 * Calculate the bin price for a trade
 * Production binning logic from CalAggsFootprint
 * Exact formula: floor((floor(price * 10000000 - 1) - (floor(price * 10000000 - 1) % (tickValue * 10000000))) / 10000000
 *
 * @param price - Trade price
 * @param tickValue - Tick size for binning
 * @returns Binned price level
 */
export function calculateBinPrice(price: number, tickValue: number): number {
  const tv = tickValue * 10000000;
  return (
    _.floor(
      _.floor(price * 10000000 - 1) - (_.floor(price * 10000000 - 1) % tv),
      0
    ) / 10000000
  );
}

/**
 * CalAggsFootprint - Calculate footprint aggregations
 * Ported exactly from cm_sync_candle/src/exchange_crypto/utils/conf_candle.ts
 *
 * Uses lodash cloneDeep for input immutability
 * Uses lodash floor for tick price calculation
 * Uses lodash findIndex for finding existing bins
 * Uses parseFloat with toFixed for precision
 *
 * @param inputAggs - Existing price bins
 * @param inputTrades - Raw trade data (Binance format)
 * @param tickValue - Tick size for binning
 * @returns New array of price bins with trade applied
 *
 */
export function CalAggsFootprint(
  inputAggs: Aggs[],
  inputTrades: RawTrade,
  tickValue: number
): Aggs[] {
  const aggs = _.cloneDeep(inputAggs);
  const trades = _.cloneDeep(inputTrades);
  const aggsRR: Aggs[] = JSON.parse(JSON.stringify(aggs));
  const tv = tickValue * 10000000;
  const tp =
    _.floor(
      _.floor(Number(trades.p) * 10000000 - 1) -
        (_.floor(Number(trades.p) * 10000000 - 1) % tv),
      0
    ) / 10000000;
  const indexTp = _.findIndex(aggsRR, function (o) {
    return o.tp == tp;
  });
  if (indexTp >= 0) {
    aggsRR[indexTp].v = parseFloat(
      (aggsRR[indexTp].v + Number(trades.q)).toFixed(8)
    );
    aggsRR[indexTp].bv =
      trades.m == false
        ? parseFloat((aggsRR[indexTp].bv + Number(trades.q)).toFixed(8))
        : aggsRR[indexTp].bv;
    aggsRR[indexTp].sv =
      trades.m == true
        ? parseFloat((aggsRR[indexTp].sv + Number(trades.q)).toFixed(8))
        : aggsRR[indexTp].sv;
    if (aggsRR[indexTp].bq !== undefined) {
      aggsRR[indexTp].bq =
        trades.m == false
          ? parseFloat(
              (
                aggsRR[indexTp].bq! +
                Number(trades.q) * Number(trades.p)
              ).toFixed(5)
            )
          : aggsRR[indexTp].bq;
      aggsRR[indexTp].sq =
        trades.m == true
          ? parseFloat(
              (
                aggsRR[indexTp].sq! +
                Number(trades.q) * Number(trades.p)
              ).toFixed(5)
            )
          : aggsRR[indexTp].sq;
    }
  } else {
    const obj: Aggs = {
      tp: tp,
      v: Number(trades.q),
      bv: trades.m == false ? Number(trades.q) : 0,
      sv: trades.m == true ? Number(trades.q) : 0,
      bq: trades.m == false ? Number(trades.q) * Number(trades.p) : 0,
      sq: trades.m == true ? Number(trades.q) * Number(trades.p) : 0,
    };
    aggsRR.push(obj);
  }
  return aggsRR;
}

/**
 * Apply a trade to price bins (wrapper for CalAggsFootprint using TradeData)
 * Pure function - returns new array, does not mutate input
 *
 * @param aggs - Existing price bins
 * @param trade - Trade to apply (TradeData format)
 * @param tickValue - Tick size for binning
 * @returns New array of price bins with trade applied
 */
export function applyTradeToAggs(
  aggs: Aggs[],
  trade: TradeData,
  tickValue: number
): Aggs[] {
  // Convert TradeData to RawTrade format for CalAggsFootprint
  const rawTrade: RawTrade = {
    p: trade.price.toString(),
    q: trade.quantity.toString(),
    m: trade.isBuyerMaker, // true = sell, false = buy
    T: trade.timestamp,
    s: trade.symbol,
    t: trade.tradeId,
  };
  return CalAggsFootprint(aggs, rawTrade, tickValue);
}

/**
 * Cal2AggsFootprint / mergeAggs - Merge two arrays of price bins
 * Ported exactly from cm_sync_candle/src/exchange_crypto/utils/conf_candle.ts
 *
 * Uses JSON.parse(JSON.stringify()) for initial copy
 * Uses lodash findIndex for finding matching tp values
 * Uses parseFloat with toFixed for precision
 *
 * @param aggSymbol - Source bins to merge (from 1s candle)
 * @param aggsSymbolOfAll - Target bins (from higher timeframe candle)
 * @returns New merged array
 *
 */
export function mergeAggs(aggSymbol: Aggs[], aggsSymbolOfAll: Aggs[]): Aggs[] {
  const aggsRR = JSON.parse(JSON.stringify(aggsSymbolOfAll));
  const aggR = JSON.parse(JSON.stringify(aggSymbol));
  for (let i = 0; i < aggSymbol.length; i++) {
    const indexTp = _.findIndex(aggsRR, function (o: Aggs) {
      return o.tp == aggR[i].tp;
    });
    if (indexTp == -1) {
      aggsRR.push(aggR[i]);
    } else if (indexTp >= 0) {
      aggsRR[indexTp].bv = parseFloat(
        (aggsRR[indexTp].bv + aggR[i].bv).toFixed(8)
      );
      aggsRR[indexTp].sv = parseFloat(
        (aggsRR[indexTp].sv + aggR[i].sv).toFixed(8)
      );
      if (aggsRR[indexTp].sq !== undefined && aggR[i].sq !== undefined) {
        aggsRR[indexTp].sq = parseFloat(
          (aggsRR[indexTp].sq + aggR[i].sq).toFixed(5)
        );
        aggsRR[indexTp].bq = parseFloat(
          (aggsRR[indexTp].bq + aggR[i].bq).toFixed(5)
        );
      }
      aggsRR[indexTp].v = parseFloat(
        (aggsRR[indexTp].v + aggR[i].v).toFixed(8)
      );
    }
  }
  return aggsRR;
}

/**
 * Calculate volume statistics from price bins
 *
 * @param aggs - Price bins
 * @returns Volume statistics
 */
export function calculateVolumeStats(aggs: Aggs[]): {
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
} {
  let totalVolume = 0;
  let buyVolume = 0;
  let sellVolume = 0;

  for (const agg of aggs) {
    totalVolume += agg.v || 0;
    buyVolume += agg.bv || 0;
    sellVolume += agg.sv || 0;
  }

  return {
    totalVolume,
    buyVolume,
    sellVolume,
    delta: buyVolume - sellVolume,
  };
}

/**
 * Calculate delta from price bins
 *
 * @param aggs - Price bins
 * @returns Delta (buy volume - sell volume)
 */
export function calculateDelta(aggs: Aggs[]): number {
  let buyVolume = 0;
  let sellVolume = 0;

  for (const agg of aggs) {
    buyVolume += agg.bv || 0;
    sellVolume += agg.sv || 0;
  }

  return buyVolume - sellVolume;
}

/**
 * Apply a trade to a candle
 * Updates the candle in place (for performance in hot path)
 *
 * @param candle - Candle to update
 * @param trade - Trade to apply
 */
export function applyTradeToCandle(
  candle: FootprintCandle,
  trade: TradeData
): void {
  candle.applyTrade(trade, candle.tv);
}

/**
 * FootprintCalculator class
 * Stateless service for footprint calculations
 * Can be used as injectable service or via static methods
 */
export class FootprintCalculator {
  /**
   * Apply a trade to price bins using CalAggsFootprint
   */
  applyTrade(aggs: Aggs[], trade: TradeData, tickValue: number): Aggs[] {
    return applyTradeToAggs(aggs, trade, tickValue);
  }

  /**
   * Apply a raw trade to price bins using CalAggsFootprint
   */
  applyRawTrade(aggs: Aggs[], trade: RawTrade, tickValue: number): Aggs[] {
    return CalAggsFootprint(aggs, trade, tickValue);
  }

  /**
   * Merge two arrays of price bins using Cal2AggsFootprint logic
   */
  mergeAggs(source: Aggs[], target: Aggs[]): Aggs[] {
    return mergeAggs(source, target);
  }

  /**
   * Calculate bin price for a trade
   */
  calculateBinPrice(price: number, tickValue: number): number {
    return calculateBinPrice(price, tickValue);
  }

  /**
   * Calculate volume statistics
   */
  calculateVolumeStats(aggs: Aggs[]): {
    totalVolume: number;
    buyVolume: number;
    sellVolume: number;
    delta: number;
  } {
    return calculateVolumeStats(aggs);
  }

  /**
   * Calculate delta
   */
  calculateDelta(aggs: Aggs[]): number {
    return calculateDelta(aggs);
  }
}

/**
 * MERGE PRICE BIN AGGREGATIONS
 * Combines multiple price bin arrays (used in timeframe rollup)
 * Migrated from tradingAlgorithms
 */
export function mergeFootprintAggs(
  existingAggs: Aggs[],
  newAggs: Aggs[]
): Aggs[] {
  // Start with existing bins
  const mergedAggs = [...existingAggs];

  // Add each new bin
  for (const newAgg of newAggs) {
    const existingIndex = mergedAggs.findIndex((agg) => agg.tp === newAgg.tp);

    if (existingIndex >= 0) {
      // Update existing bin
      const existing = mergedAggs[existingIndex];
      existing.v += newAgg.v;
      existing.bv += newAgg.bv;
      existing.sv += newAgg.sv;
      existing.bq = (existing.bq || 0) + (newAgg.bq || 0);
      existing.sq = (existing.sq || 0) + (newAgg.sq || 0);
      existing.q = (existing.bq || 0) + (existing.sq || 0);
    } else {
      // Add new bin as copy
      mergedAggs.push({ ...newAgg });
    }
  }

  // Sort by price (production requirement)
  return mergedAggs.sort((a, b) => a.tp - b.tp);
}

/**
 * CALCULATE VOLUME DELTA FROM PRICE BINS
 * Quick delta calculation without full stats
 * Migrated from tradingAlgorithms
 */
export function calculateVolumeDelta(bins: Aggs[]): number {
  let buyVolume = 0;
  let sellVolume = 0;

  for (const bin of bins) {
    buyVolume += bin.bv || 0;
    sellVolume += bin.sv || 0;
  }

  return buyVolume - sellVolume;
}

/**
 * NORMALIZE PRICE TO TICK SIZE
 * Ensure price conforms to tick precision
 * Migrated from tradingAlgorithms
 */
export function normalizePrice(price: number, tickSize: number): number {
  // Round to tick size precision
  return Math.round(price / tickSize) * tickSize;
}

/**
 * VALIDATE TRADE PRICE AGAINST TICK SIZE
 * Check if price is valid for given instrument
 * Migrated from tradingAlgorithms
 */
export function validateTradePrice(
  price: number,
  tickSize: number,
  minPrice?: number,
  maxPrice?: number
): boolean {
  // Must be multiple of tick size
  const normalized = normalizePrice(price, tickSize);
  if (Math.abs(price - normalized) > 0.0000001) {
    return false; // Not on tick boundary
  }

  // Check range if provided
  if (minPrice !== undefined && price < minPrice) {
    return false;
  }
  if (maxPrice !== undefined && price > maxPrice) {
    return false;
  }

  return true;
}
