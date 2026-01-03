/**
 * CandleCompletionDetector Service
 *
 * Pure function service for detecting when candles should complete.
 * Determines if a timeframe boundary has been crossed.
 *
 */

import { Timeframe } from '../value-objects/Timeframe.js';
import { FootprintCandle } from '../entities/FootprintCandle.js';

/**
 * Check if a timeframe boundary has been crossed between two timestamps
 *
 * @param previousTimestamp - Previous trade timestamp
 * @param currentTimestamp - Current trade timestamp
 * @param timeframe - Timeframe to check
 * @returns true if the timeframe boundary was crossed
 */
function hasTimeframeCrossed(
  previousTimestamp: number,
  currentTimestamp: number,
  timeframe: Timeframe
): boolean {
  const timeframeMs = timeframe.milliseconds;

  // Calculate which period each timestamp belongs to
  const previousPeriod = Math.floor(previousTimestamp / timeframeMs);
  const currentPeriod = Math.floor(currentTimestamp / timeframeMs);

  return currentPeriod > previousPeriod;
}

/**
 * Check if a candle should be completed based on the next trade timestamp
 *
 * @param candle - The candle to check
 * @param nextTradeTimestamp - Timestamp of the next trade
 * @returns true if the candle should be completed
 */
export function shouldComplete(
  candle: FootprintCandle,
  nextTradeTimestamp: number
): boolean {
  // If candle has no start time, it's not ready to complete
  if (candle.t === 0) {
    return false;
  }

  // If candle is already complete, don't complete again
  if (candle.x) {
    return false;
  }

  const timeframe = new Timeframe(candle.i);
  return hasTimeframeCrossed(candle.t, nextTradeTimestamp, timeframe);
}

/**
 * Calculate the completion time for a candle
 *
 * @param candleStartTime - Start time of the candle
 * @param timeframe - Timeframe of the candle
 * @returns Completion time (end of the period - 1ms)
 */
export function calculateCompletionTime(
  candleStartTime: number,
  timeframe: Timeframe
): number {
  const timeframeMs = timeframe.milliseconds;
  const periodStart = Math.floor(candleStartTime / timeframeMs) * timeframeMs;
  return periodStart + timeframeMs - 1;
}
