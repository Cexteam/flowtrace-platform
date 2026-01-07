/**
 * IndexManager
 *
 * Manages index files (.idx) for period files.
 * Index files contain metadata for quick lookups without reading binary files.
 *
 * Features:
 * - O(1) duplicate detection using lastTimestamp
 * - Time range filtering for query optimization
 * - Index recovery from binary files
 * - JSON format for human readability
 */

import type { FileStoragePort } from '../../../../features/candlePersistence/application/ports/out/FileStoragePort.js';
import type { IndexData, PartitionPattern, CandleData } from '../types.js';

/**
 * IndexManager
 * Manages .idx files for period files
 */
export class IndexManager {
  constructor(private readonly fileStorage: FileStoragePort) {}

  /**
   * Read index file for a period
   * @param basePath - Base path to timeframe directory (e.g., "BINANCE/BTCUSDT/candles/1m")
   * @param periodName - Period name (e.g., "2025-01-08")
   * @returns IndexData or null if not found
   */
  async readIndex(
    basePath: string,
    periodName: string
  ): Promise<IndexData | null> {
    const indexPath = `${basePath}/${periodName}.idx`;

    try {
      const buffer = await this.fileStorage.readFile(indexPath);
      if (!buffer) {
        return null;
      }

      return JSON.parse(buffer.toString('utf-8')) as IndexData;
    } catch (error) {
      // Log and return null for corrupted index files
      console.warn(`Failed to read index file ${indexPath}:`, error);
      return null;
    }
  }

  /**
   * Write/update index file for a period
   * @param basePath - Base path to timeframe directory
   * @param indexData - Index data to write
   */
  async writeIndex(basePath: string, indexData: IndexData): Promise<void> {
    const indexPath = `${basePath}/${indexData.period}.idx`;
    const buffer = Buffer.from(JSON.stringify(indexData, null, 2), 'utf-8');
    await this.fileStorage.writeFile(indexPath, buffer);
  }

  /**
   * Update index after appending a candle
   * Creates new index if it doesn't exist, updates if it does
   * @param basePath - Base path to timeframe directory
   * @param periodName - Period name
   * @param pattern - Partition pattern
   * @param timestamp - Candle timestamp
   * @param symbol - Symbol
   * @param interval - Interval/timeframe
   */
  async updateIndexAfterAppend(
    basePath: string,
    periodName: string,
    pattern: PartitionPattern,
    timestamp: number,
    symbol: string,
    interval: string
  ): Promise<void> {
    const existingIndex = await this.readIndex(basePath, periodName);

    if (existingIndex) {
      // Update existing index
      existingIndex.count++;
      existingIndex.lastTimestamp = Math.max(
        existingIndex.lastTimestamp,
        timestamp
      );
      existingIndex.firstTimestamp = Math.min(
        existingIndex.firstTimestamp,
        timestamp
      );
      await this.writeIndex(basePath, existingIndex);
    } else {
      // Create new index
      const newIndex: IndexData = {
        period: periodName,
        pattern,
        count: 1,
        firstTimestamp: timestamp,
        lastTimestamp: timestamp,
        symbol,
        interval,
      };
      await this.writeIndex(basePath, newIndex);
    }
  }

  /**
   * Rebuild index from candle data (recovery)
   * Used when index file is missing or corrupted
   * @param basePath - Base path to timeframe directory
   * @param periodName - Period name
   * @param pattern - Partition pattern
   * @param candles - Array of candle data from binary file
   * @returns Rebuilt IndexData
   */
  async rebuildIndex(
    basePath: string,
    periodName: string,
    pattern: PartitionPattern,
    candles: CandleData[]
  ): Promise<IndexData> {
    if (candles.length === 0) {
      throw new Error('Cannot create index for empty candle array');
    }

    // Sort by timestamp to get correct first/last
    const sorted = [...candles].sort((a, b) => a.t - b.t);

    const indexData: IndexData = {
      period: periodName,
      pattern,
      count: candles.length,
      firstTimestamp: sorted[0]!.t,
      lastTimestamp: sorted[sorted.length - 1]!.t,
      symbol: sorted[0]!.s,
      interval: sorted[0]!.i,
    };

    await this.writeIndex(basePath, indexData);
    return indexData;
  }

  /**
   * Filter periods by time range using index files
   * Returns only periods that overlap with the query range
   * @param basePath - Base path to timeframe directory
   * @param periods - Array of period names to filter
   * @param startTime - Query start time (optional)
   * @param endTime - Query end time (optional)
   * @returns Filtered array of period names
   */
  async filterPeriodsByTimeRange(
    basePath: string,
    periods: string[],
    startTime?: number,
    endTime?: number
  ): Promise<string[]> {
    // If no time range specified, return all periods
    if (startTime === undefined && endTime === undefined) {
      return periods;
    }

    const result: string[] = [];

    for (const period of periods) {
      const index = await this.readIndex(basePath, period);

      if (!index) {
        // No index file - include period to be safe
        result.push(period);
        continue;
      }

      // Check if period overlaps with query range
      const periodStart = index.firstTimestamp;
      const periodEnd = index.lastTimestamp;

      // Skip if period ends before query start
      if (startTime !== undefined && periodEnd < startTime) {
        continue;
      }

      // Skip if period starts after query end
      if (endTime !== undefined && periodStart > endTime) {
        continue;
      }

      result.push(period);
    }

    return result;
  }

  /**
   * Check if a timestamp already exists in the period (for duplicate detection)
   * O(1) operation using index file's lastTimestamp
   *
   * Logic:
   * - If timestamp > lastTimestamp: NOT a duplicate (common case for sequential appends)
   * - If timestamp < firstTimestamp: NOT a duplicate
   * - If timestamp is within range: MIGHT be duplicate (conservative approach)
   *
   * @param basePath - Base path to timeframe directory
   * @param periodName - Period name
   * @param timestamp - Timestamp to check
   * @returns true if likely duplicate, false if definitely not
   */
  async isDuplicate(
    basePath: string,
    periodName: string,
    timestamp: number
  ): Promise<boolean> {
    const index = await this.readIndex(basePath, periodName);

    if (!index) {
      // No index = no data = not a duplicate
      return false;
    }

    // If timestamp is after lastTimestamp, it's definitely not a duplicate
    // This is the common case for sequential candle appends
    if (timestamp > index.lastTimestamp) {
      return false;
    }

    // If timestamp is before firstTimestamp, it's definitely not a duplicate
    if (timestamp < index.firstTimestamp) {
      return false;
    }

    // Timestamp is within range - could be duplicate
    // For exact check, would need to scan file (expensive)
    // Conservative approach: assume it might be a duplicate
    return true;
  }

  /**
   * Get all index files in a directory
   * @param basePath - Base path to timeframe directory
   * @returns Array of IndexData for all periods
   */
  async getAllIndexes(basePath: string): Promise<IndexData[]> {
    const files = await this.fileStorage.listFiles(basePath, '.idx');
    const indexes: IndexData[] = [];

    for (const file of files) {
      const periodName = file.replace('.idx', '');
      const index = await this.readIndex(basePath, periodName);
      if (index) {
        indexes.push(index);
      }
    }

    return indexes;
  }

  /**
   * Infer partition pattern from period name format
   * @param periodName - Period name (e.g., "2025-01-08", "2025-W02", "2025-Q1")
   * @returns Inferred partition pattern
   */
  inferPattern(periodName: string): PartitionPattern {
    if (/^\d{4}-\d{2}-\d{2}$/.test(periodName)) {
      return 'day';
    }
    if (/^\d{4}-W\d{2}$/.test(periodName)) {
      return 'week';
    }
    if (/^\d{4}-\d{2}$/.test(periodName)) {
      return 'month';
    }
    if (/^\d{4}-Q[1-4]$/.test(periodName)) {
      return 'quarter';
    }
    if (/^\d{4}$/.test(periodName)) {
      return 'year';
    }
    return 'day'; // Default
  }
}
