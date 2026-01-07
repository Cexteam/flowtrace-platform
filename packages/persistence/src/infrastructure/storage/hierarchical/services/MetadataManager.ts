/**
 * MetadataManager
 *
 * Manages metadata.json files for timeframe directories.
 * Provides overview of stored data without scanning all files.
 *
 * Features:
 * - Directory-level metadata (total periods, date range)
 * - Automatic updates when candles are appended
 * - JSON format for human readability
 */

import type { FileStoragePort } from '../../../../features/candlePersistence/application/ports/out/FileStoragePort.js';
import type { TimeframeMetadata, PartitionPattern } from '../types.js';

/** Metadata file name */
const METADATA_FILE = 'metadata.json';

/** Current metadata schema version */
const METADATA_VERSION = '1.0';

/**
 * MetadataManager
 * Manages metadata.json files for timeframe directories
 */
export class MetadataManager {
  constructor(private readonly fileStorage: FileStoragePort) {}

  /**
   * Read metadata file from a timeframe directory
   * @param basePath - Base path to timeframe directory (e.g., "BINANCE/BTCUSDT/candles/1m")
   * @returns TimeframeMetadata or null if not found
   */
  async readMetadata(basePath: string): Promise<TimeframeMetadata | null> {
    const metadataPath = `${basePath}/${METADATA_FILE}`;

    try {
      const buffer = await this.fileStorage.readFile(metadataPath);
      if (!buffer) {
        return null;
      }

      return JSON.parse(buffer.toString('utf-8')) as TimeframeMetadata;
    } catch (error) {
      // Log and return null for corrupted metadata files
      console.warn(`Failed to read metadata file ${metadataPath}:`, error);
      return null;
    }
  }

  /**
   * Write metadata file to a timeframe directory
   * @param basePath - Base path to timeframe directory
   * @param metadata - Metadata to write
   */
  async writeMetadata(
    basePath: string,
    metadata: TimeframeMetadata
  ): Promise<void> {
    const metadataPath = `${basePath}/${METADATA_FILE}`;
    const buffer = Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8');
    await this.fileStorage.writeFile(metadataPath, buffer);
  }

  /**
   * Update metadata after appending a candle to period file
   * Scans directory for period files and updates metadata accordingly
   * @param basePath - Base path to timeframe directory
   * @param exchange - Exchange name
   * @param symbol - Symbol
   * @param interval - Interval/timeframe
   * @param pattern - Partition pattern
   * @param schema - Data schema type ('candle' or 'footprint')
   */
  async updateMetadata(
    basePath: string,
    exchange: string,
    symbol: string,
    interval: string,
    pattern: PartitionPattern,
    schema: 'candle' | 'footprint'
  ): Promise<void> {
    // List all period files
    const files = await this.fileStorage.listFiles(basePath, '.bin');
    const periods = files.map((f: string) => f.replace('.bin', '')).sort();

    const metadata: TimeframeMetadata = {
      version: METADATA_VERSION,
      schema,
      symbol,
      interval,
      pattern,
      exchange,
      lastUpdated: new Date().toISOString(),
      totalPeriods: periods.length,
      periodRange: {
        from: periods[0] ?? '',
        to: periods[periods.length - 1] ?? '',
      },
    };

    await this.writeMetadata(basePath, metadata);
  }

  /**
   * Validate metadata against actual files in directory
   * @param basePath - Base path to timeframe directory
   * @returns Validation result with any discrepancies
   */
  async validateMetadata(basePath: string): Promise<{
    valid: boolean;
    errors: string[];
    metadata: TimeframeMetadata | null;
  }> {
    const errors: string[] = [];
    const metadata = await this.readMetadata(basePath);

    if (!metadata) {
      return {
        valid: false,
        errors: ['Metadata file not found'],
        metadata: null,
      };
    }

    // Check actual period files
    const files = await this.fileStorage.listFiles(basePath, '.bin');
    const actualPeriods = files
      .map((f: string) => f.replace('.bin', ''))
      .sort();

    if (metadata.totalPeriods !== actualPeriods.length) {
      errors.push(
        `Period count mismatch: metadata=${metadata.totalPeriods}, actual=${actualPeriods.length}`
      );
    }

    if (actualPeriods.length > 0) {
      if (metadata.periodRange.from !== actualPeriods[0]) {
        errors.push(
          `Period range 'from' mismatch: metadata=${metadata.periodRange.from}, actual=${actualPeriods[0]}`
        );
      }
      if (metadata.periodRange.to !== actualPeriods[actualPeriods.length - 1]) {
        errors.push(
          `Period range 'to' mismatch: metadata=${
            metadata.periodRange.to
          }, actual=${actualPeriods[actualPeriods.length - 1]}`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      metadata,
    };
  }

  /**
   * Rebuild metadata from actual files in directory
   * Used for recovery when metadata is missing or corrupted
   * @param basePath - Base path to timeframe directory
   * @param exchange - Exchange name
   * @param symbol - Symbol
   * @param interval - Interval/timeframe
   * @param pattern - Partition pattern
   * @param schema - Data schema type
   * @returns Rebuilt metadata
   */
  async rebuildMetadata(
    basePath: string,
    exchange: string,
    symbol: string,
    interval: string,
    pattern: PartitionPattern,
    schema: 'candle' | 'footprint'
  ): Promise<TimeframeMetadata> {
    await this.updateMetadata(
      basePath,
      exchange,
      symbol,
      interval,
      pattern,
      schema
    );
    const metadata = await this.readMetadata(basePath);
    return metadata!;
  }
}
