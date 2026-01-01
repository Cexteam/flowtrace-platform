/**
 * CandleCompletionDetector Service
 *
 * Pure function service for detecting when candles should complete.
 * Determines if a timeframe boundary has been crossed.
 *
 */

import { Timeframe } from '../value-objects/Timeframe.js';
import { FootprintCandle } from '../entities/FootprintCandle.js';
import _ from 'lodash';

/**
 * Check if a timeframe boundary has been crossed between two timestamps
 *
 * @param previousTimestamp - Previous trade timestamp
 * @param currentTimestamp - Current trade timestamp
 * @param timeframe - Timeframe to check
 * @returns true if the timeframe boundary was crossed
 */
export function hasTimeframeCrossed(
  previousTimestamp: number,
  currentTimestamp: number,
  timeframe: Timeframe
): boolean {
  const timeframeMs = timeframe.milliseconds;

  // Calculate which period each timestamp belongs to
  const previousPeriod = Math.floor(previousTimestamp / timeframeMs);
  const currentPeriod = Math.floor(currentTimestamp / timeframeMs);

  // const opentime: number =
  //         _.floor(currentTimestamp) - _.floor(currentTimestamp % 1000);
  // console.log("opentime", opentime)
  // console.log("currentPeriod", currentPeriod)
  // console.log("previousPeriod", previousPeriod)
  // console.log(".....................................")

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

/**
 * Get the period start time for a timestamp
 *
 * @param timestamp - Any timestamp
 * @param timeframe - Timeframe to align to
 * @returns Start of the period containing the timestamp
 */
export function getPeriodStart(
  timestamp: number,
  timeframe: Timeframe
): number {
  const timeframeMs = timeframe.milliseconds;
  return Math.floor(timestamp / timeframeMs) * timeframeMs;
}

/**
 * Get the period end time for a timestamp
 *
 * @param timestamp - Any timestamp
 * @param timeframe - Timeframe to align to
 * @returns End of the period containing the timestamp (period start + duration - 1)
 */
export function getPeriodEnd(timestamp: number, timeframe: Timeframe): number {
  const periodStart = getPeriodStart(timestamp, timeframe);
  return periodStart + timeframe.milliseconds - 1;
}

/**
 * Check if two timestamps are in the same period
 *
 * @param timestamp1 - First timestamp
 * @param timestamp2 - Second timestamp
 * @param timeframe - Timeframe to check
 * @returns true if both timestamps are in the same period
 */
export function isSamePeriod(
  timestamp1: number,
  timestamp2: number,
  timeframe: Timeframe
): boolean {
  return (
    getPeriodStart(timestamp1, timeframe) ===
    getPeriodStart(timestamp2, timeframe)
  );
}

/**
 * CandleCompletionDetector class
 * Stateless service for candle completion detection
 * Can be used as injectable service or via static methods
 */
export class CandleCompletionDetector {
  /**
   * Check if a timeframe boundary has been crossed
   */
  hasTimeframeCrossed(
    previousTimestamp: number,
    currentTimestamp: number,
    timeframe: Timeframe
  ): boolean {
    return hasTimeframeCrossed(previousTimestamp, currentTimestamp, timeframe);
  }

  /**
   * Check if a candle should be completed
   */
  shouldComplete(candle: FootprintCandle, nextTradeTimestamp: number): boolean {
    return shouldComplete(candle, nextTradeTimestamp);
  }

  /**
   * Calculate completion time for a candle
   */
  calculateCompletionTime(
    candleStartTime: number,
    timeframe: Timeframe
  ): number {
    return calculateCompletionTime(candleStartTime, timeframe);
  }

  /**
   * Get period start time
   */
  getPeriodStart(timestamp: number, timeframe: Timeframe): number {
    return getPeriodStart(timestamp, timeframe);
  }

  /**
   * Get period end time
   */
  getPeriodEnd(timestamp: number, timeframe: Timeframe): number {
    return getPeriodEnd(timestamp, timeframe);
  }

  /**
   * Check if two timestamps are in the same period
   */
  isSamePeriod(
    timestamp1: number,
    timestamp2: number,
    timeframe: Timeframe
  ): boolean {
    return isSamePeriod(timestamp1, timestamp2, timeframe);
  }
}
