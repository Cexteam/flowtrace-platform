/**
 * TimeframeRollup Service
 *
 * Pure function service for rolling up completed candles to higher timeframes.
 * Implements UpdatedGroupCandles logic from production.
 * Ported exactly from cm_sync_candle/src/exchange_crypto/utils/conf_candle.ts
 *
 */

import _ from 'lodash';
import { Timeframe } from '../value-objects/Timeframe.js';
import { FootprintCandle } from '../entities/FootprintCandle.js';
import { CandleGroup } from '../entities/CandleGroup.js';
import { mergeAggs } from './FootprintCalculator.js';

/**
 * Result of a rollup operation
 */
export interface RollupResult {
  /** Updated candle group */
  candleGroup: CandleGroup;
  /** Candles that completed during this rollup */
  completedCandles: FootprintCandle[];
}

/**
 * Interval names matching original cm_sync_candle
 */
const interval = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '8h',
  '12h',
  '1d',
];

/**
 * Resolution in seconds matching original cm_sync_candle
 */
const resolutions = [
  60, 180, 300, 900, 1800, 3600, 7200, 14400, 28800, 43200, 86400,
];

/**
 * UpdatedGroupCandles - Roll up a completed 1s candle to all higher timeframes
 * Ported exactly from cm_sync_candle/src/exchange_crypto/utils/conf_candle.ts
 *
 * Pure function - uses cloneDeep to avoid mutating inputs
 *
 * @param inputCandleGroup - Current candle group
 * @param inputCandle - The completed 1s candle
 * @param time - Timestamp for completion detection (trade time)
 * @returns RollupResult with updated group and completed candles
 *
 */
export function UpdatedGroupCandles(
  inputCandleGroup: CandleGroup,
  inputCandle: FootprintCandle,
  time: number
): RollupResult {
  // Clone inputs to avoid mutations (matching original cloneDeep behavior)
  const iCandle = _.cloneDeep(inputCandle);
  const iCandleGroup = _.cloneDeep(inputCandleGroup);

  const completedCandles: FootprintCandle[] = [];

  // Process each higher timeframe (matching original loop through interval/resolutions)
  for (let i = 0; i < interval.length; i++) {
    const timeframeName = interval[i];
    const resolution = resolutions[i];
    const timeframe = new Timeframe(timeframeName);

    // Get current candle for this timeframe
    const currentCandle = iCandleGroup.getCandle(timeframe);

    // Calculate checkTime: floor(time) - floor(time % (resolution * 1000))
    const checkTime: number =
      _.floor(time) - _.floor(time % (resolution * 1000));

    // Calculate opentime: floor(candle.t) - floor(candle.t % (resolution * 1000))
    const opentime: number =
      _.floor(iCandle.t) - _.floor(iCandle.t % (resolution * 1000));

    if (opentime > currentCandle.t) {
      // New period started - reset candle with completed candle data
      // Matching original: dataSymbols[i] = { ... }
      currentCandle.e = 'CANDLESTICK';
      currentCandle.tz = 'UTC';
      currentCandle.ex = iCandle.ex;
      currentCandle.a = iCandle.a;
      currentCandle.s = iCandle.s;
      currentCandle.i = timeframeName;
      currentCandle.vi = resolution;
      currentCandle.t = opentime;
      currentCandle.o = iCandle.o;
      currentCandle.h = iCandle.h;
      currentCandle.l = iCandle.l;
      currentCandle.c = iCandle.c;
      currentCandle.ct = opentime + resolution * 1000 - 1;
      currentCandle.v = iCandle.v;
      currentCandle.bv = iCandle.bv;
      currentCandle.sv = iCandle.sv;
      currentCandle.q = iCandle.q;
      currentCandle.bq = iCandle.bq;
      currentCandle.sq =
        iCandle.sq === undefined || iCandle.sq === 0
          ? Math.max(0, iCandle.q - iCandle.bq)
          : iCandle.sq;
      currentCandle.n = iCandle.n;
      currentCandle.d = iCandle.d;
      currentCandle.dMax = iCandle.dMax;
      currentCandle.dMin = iCandle.dMin;
      currentCandle.tv = iCandle.tv;
      currentCandle.aggs = JSON.parse(JSON.stringify(iCandle.aggs));
      currentCandle.f = iCandle.f;
      currentCandle.ls = iCandle.l; // Note: original uses iCandle.l (low price) for ls
      currentCandle.x = false;
    } else if (opentime === currentCandle.t) {
      // Same period - merge completed candle into current
      // Matching original merge logic exactly

      // Fix: If current candle has o = 0, set it from the incoming candle
      // This handles the case where the candle was reset but not properly initialized
      if (currentCandle.o === 0 && iCandle.o !== 0) {
        currentCandle.o = iCandle.o;
      }

      currentCandle.h =
        iCandle.h > currentCandle.h ? iCandle.h : currentCandle.h;
      currentCandle.l =
        iCandle.l < currentCandle.l ? iCandle.l : currentCandle.l;
      currentCandle.c = iCandle.c;
      currentCandle.v = parseFloat((currentCandle.v + iCandle.v).toFixed(8));
      currentCandle.bv = parseFloat((currentCandle.bv + iCandle.bv).toFixed(8));
      currentCandle.sv = parseFloat((currentCandle.sv + iCandle.sv).toFixed(8));
      currentCandle.q = parseFloat((currentCandle.q + iCandle.q).toFixed(5));
      currentCandle.bq = parseFloat((currentCandle.bq + iCandle.bq).toFixed(8));
      // Always recalculate sq from q - bq to avoid floating point accumulation errors
      // Use Math.max(0, ...) to handle floating point precision issues where bq > q
      currentCandle.sq = Math.max(
        0,
        parseFloat((currentCandle.q - currentCandle.bq).toFixed(5))
      );
      currentCandle.n = currentCandle.n + iCandle.n;
      currentCandle.ls = iCandle.ls;

      // Update delta
      const delta = parseFloat(
        (currentCandle.bv - currentCandle.sv).toFixed(8)
      );
      currentCandle.d = delta;
      currentCandle.dMax =
        delta > currentCandle.dMax ? delta : currentCandle.dMax;
      currentCandle.dMin =
        delta < currentCandle.dMin ? delta : currentCandle.dMin;

      // Merge footprint bins using Cal2AggsFootprint logic
      const rsAggs = mergeAggs(iCandle.aggs, currentCandle.aggs);
      currentCandle.aggs = JSON.parse(JSON.stringify(rsAggs));

      // Check for completion: if checkTime !== opentime
      if (checkTime !== opentime) {
        currentCandle.x = true;
        // Add to completed candles for publishing
        completedCandles.push(currentCandle.clone());
      }
    }
  }

  return {
    candleGroup: iCandleGroup,
    completedCandles,
  };
}

/**
 * Roll up a completed 1s candle to all higher timeframes
 * Wrapper for UpdatedGroupCandles for backward compatibility
 *
 * @param candleGroup - Current candle group
 * @param completedCandle - The completed 1s candle
 * @param nextTradeTimestamp - Timestamp of the next trade (for completion detection)
 * @returns RollupResult with updated group and completed candles
 */
export function rollup(
  candleGroup: CandleGroup,
  completedCandle: FootprintCandle,
  nextTradeTimestamp: number
): RollupResult {
  return UpdatedGroupCandles(candleGroup, completedCandle, nextTradeTimestamp);
}
