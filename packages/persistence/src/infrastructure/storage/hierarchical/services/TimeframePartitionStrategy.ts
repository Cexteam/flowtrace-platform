/**
 * TimeframePartitionStrategy
 *
 * Determines file partitioning strategy based on timeframe.
 * Maps timeframes to partition patterns and generates period file names.
 *
 * Partition patterns:
 * - day: 1m, 3m → YYYY-MM-DD.bin (1440 candles/day for 1m)
 * - week: 5m, 15m → YYYY-Www.bin (2016 candles/week for 5m)
 * - month: 30m, 1h → YYYY-MM.bin (720 candles/month for 1h)
 * - quarter: 2h, 4h → YYYY-Qq.bin (540 candles/quarter for 4h)
 * - year: 8h, 12h, 1d → YYYY.bin (365 candles/year for 1d)
 */

import type { PartitionPattern, PartitionInfo } from '../types.js';

/**
 * Mapping of timeframes to partition patterns
 */
const TIMEFRAME_PATTERNS: Record<string, PartitionPattern> = {
  '1m': 'day',
  '3m': 'day',
  '5m': 'week',
  '15m': 'week',
  '30m': 'month',
  '1h': 'month',
  '2h': 'quarter',
  '4h': 'quarter',
  '8h': 'year',
  '12h': 'year',
  '1d': 'year',
};

/**
 * TimeframePartitionStrategy
 * Stateless service for determining partition info based on timeframe and timestamp.
 */
export class TimeframePartitionStrategy {
  /**
   * Get partition pattern for a timeframe
   * @param timeframe - Timeframe string (e.g., '1m', '5m', '1h')
   * @returns Partition pattern
   */
  getPattern(timeframe: string): PartitionPattern {
    return TIMEFRAME_PATTERNS[timeframe] ?? 'day';
  }

  /**
   * Get partition info for a timestamp
   * @param timeframe - Timeframe string
   * @param timestamp - Timestamp in milliseconds
   * @returns PartitionInfo with period details
   */
  getPartitionInfo(timeframe: string, timestamp: number): PartitionInfo {
    const pattern = this.getPattern(timeframe);
    const date = new Date(timestamp);

    switch (pattern) {
      case 'day':
        return this.getDayPartition(date);
      case 'week':
        return this.getWeekPartition(date);
      case 'month':
        return this.getMonthPartition(date);
      case 'quarter':
        return this.getQuarterPartition(date);
      case 'year':
        return this.getYearPartition(date);
      default:
        return this.getDayPartition(date);
    }
  }

  /**
   * Get all period file names between two timestamps
   * Used for query optimization - identifies which files to load
   * @param timeframe - Timeframe string
   * @param startTime - Start timestamp (inclusive)
   * @param endTime - End timestamp (inclusive)
   * @returns Array of PartitionInfo for all periods in range
   */
  getPeriodsBetween(
    timeframe: string,
    startTime: number,
    endTime: number
  ): PartitionInfo[] {
    const pattern = this.getPattern(timeframe);
    const periods: PartitionInfo[] = [];

    let currentTime = startTime;
    const visited = new Set<string>();

    while (currentTime <= endTime) {
      const partition = this.getPartitionInfo(timeframe, currentTime);

      // Avoid duplicates
      if (!visited.has(partition.periodName)) {
        visited.add(partition.periodName);
        periods.push(partition);
      }

      // Move to next period
      currentTime = partition.endTimestamp + 1;
    }

    return periods;
  }

  // ===========================================================================
  // Private Partition Methods
  // ===========================================================================

  /**
   * Get day partition info
   * Format: YYYY-MM-DD
   */
  private getDayPartition(date: Date): PartitionInfo {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();

    const periodName = `${year}-${String(month + 1).padStart(2, '0')}-${String(
      day
    ).padStart(2, '0')}`;

    const startOfDay = Date.UTC(year, month, day, 0, 0, 0, 0);
    const endOfDay = Date.UTC(year, month, day, 23, 59, 59, 999);

    return {
      pattern: 'day',
      periodName,
      fileName: `${periodName}.bin`,
      startTimestamp: startOfDay,
      endTimestamp: endOfDay,
    };
  }

  /**
   * Get week partition info
   * Format: YYYY-Www (ISO week)
   */
  private getWeekPartition(date: Date): PartitionInfo {
    const { year, week } = this.getISOWeek(date);
    const periodName = `${year}-W${String(week).padStart(2, '0')}`;

    // Calculate week boundaries
    const { start, end } = this.getISOWeekBoundaries(year, week);

    return {
      pattern: 'week',
      periodName,
      fileName: `${periodName}.bin`,
      startTimestamp: start,
      endTimestamp: end,
    };
  }

  /**
   * Get month partition info
   * Format: YYYY-MM
   */
  private getMonthPartition(date: Date): PartitionInfo {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();

    const periodName = `${year}-${String(month + 1).padStart(2, '0')}`;

    const startOfMonth = Date.UTC(year, month, 1, 0, 0, 0, 0);
    // Last day of month
    const endOfMonth = Date.UTC(year, month + 1, 0, 23, 59, 59, 999);

    return {
      pattern: 'month',
      periodName,
      fileName: `${periodName}.bin`,
      startTimestamp: startOfMonth,
      endTimestamp: endOfMonth,
    };
  }

  /**
   * Get quarter partition info
   * Format: YYYY-Qq
   */
  private getQuarterPartition(date: Date): PartitionInfo {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const quarter = Math.floor(month / 3) + 1;

    const periodName = `${year}-Q${quarter}`;

    const startMonth = (quarter - 1) * 3;
    const endMonth = startMonth + 2;

    const startOfQuarter = Date.UTC(year, startMonth, 1, 0, 0, 0, 0);
    // Last day of quarter
    const endOfQuarter = Date.UTC(year, endMonth + 1, 0, 23, 59, 59, 999);

    return {
      pattern: 'quarter',
      periodName,
      fileName: `${periodName}.bin`,
      startTimestamp: startOfQuarter,
      endTimestamp: endOfQuarter,
    };
  }

  /**
   * Get year partition info
   * Format: YYYY
   */
  private getYearPartition(date: Date): PartitionInfo {
    const year = date.getUTCFullYear();
    const periodName = `${year}`;

    const startOfYear = Date.UTC(year, 0, 1, 0, 0, 0, 0);
    const endOfYear = Date.UTC(year, 11, 31, 23, 59, 59, 999);

    return {
      pattern: 'year',
      periodName,
      fileName: `${periodName}.bin`,
      startTimestamp: startOfYear,
      endTimestamp: endOfYear,
    };
  }

  // ===========================================================================
  // ISO Week Helpers
  // ===========================================================================

  /**
   * Get ISO week number and year for a date
   * ISO weeks start on Monday
   */
  private getISOWeek(date: Date): { year: number; week: number } {
    const d = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );

    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);

    // Get first day of year
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));

    // Calculate full weeks to nearest Thursday
    const weekNum = Math.ceil(
      ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
    );

    return { year: d.getUTCFullYear(), week: weekNum };
  }

  /**
   * Get ISO week boundaries (start and end timestamps)
   */
  private getISOWeekBoundaries(
    year: number,
    week: number
  ): { start: number; end: number } {
    // Find January 4th of the year (always in week 1)
    const jan4 = new Date(Date.UTC(year, 0, 4));

    // Find the Monday of week 1
    const dayOfWeek = jan4.getUTCDay() || 7; // Make Sunday = 7
    const week1Monday = new Date(jan4);
    week1Monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

    // Calculate the Monday of the target week
    const targetMonday = new Date(week1Monday);
    targetMonday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);

    // Calculate Sunday of the target week
    const targetSunday = new Date(targetMonday);
    targetSunday.setUTCDate(targetMonday.getUTCDate() + 6);
    targetSunday.setUTCHours(23, 59, 59, 999);

    return {
      start: targetMonday.getTime(),
      end: targetSunday.getTime(),
    };
  }
}
