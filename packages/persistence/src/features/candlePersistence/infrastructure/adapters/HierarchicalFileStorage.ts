/**
 * HierarchicalFileStorage
 *
 * Main orchestrator for hierarchical file storage.
 * Implements CandleStoragePort with Append-Only strategy for O(1) writes.
 *
 * Directory structure:
 * {baseDir}/{EXCHANGE}/{SYMBOL}/candles/{tf}/{period}.bin
 * {baseDir}/{EXCHANGE}/{SYMBOL}/footprints/{tf}/{period}.bin
 *
 * Features:
 * - Append-Only writes for 500+ symbols performance
 * - Separate candle/footprint storage
 * - Index-based duplicate detection
 * - Period file headers for quick metadata access
 */

import { injectable, inject } from 'inversify';
import type { FootprintCandle } from '@flowtrace/core';
import type { CandleStoragePort } from '../../application/ports/out/CandleStoragePort.js';
import type { FileStoragePort } from '../../application/ports/out/FileStoragePort.js';
import { CANDLE_PERSISTENCE_TYPES } from '../../di/types.js';
import {
  type CandleData,
  type FootprintData,
  type PeriodFileHeader,
  type HierarchicalStorageConfig,
  PERIOD_FILE_HEADER_SIZE,
  PERIOD_FILE_MAGIC,
  PERIOD_FILE_VERSION,
} from '../../../../infrastructure/storage/hierarchical/types.js';
import { TimeframePartitionStrategy } from '../../../../infrastructure/storage/hierarchical/services/TimeframePartitionStrategy.js';
import { IndexManager } from '../../../../infrastructure/storage/hierarchical/services/IndexManager.js';
import { MetadataManager } from '../../../../infrastructure/storage/hierarchical/services/MetadataManager.js';

/**
 * HierarchicalFileStorage
 * Implements CandleStoragePort with hierarchical file structure
 */
@injectable()
export class HierarchicalFileStorage implements CandleStoragePort {
  private readonly partitionStrategy: TimeframePartitionStrategy;
  private readonly indexManager: IndexManager;
  private readonly metadataManager: MetadataManager;

  // In-memory cache for duplicate detection (prevents race conditions)
  // Each period typically has ~700 candles max (1 week of 15m), so 1000 is sufficient
  private readonly recentTimestamps = new Map<string, Set<number>>();
  private readonly MAX_CACHE_SIZE = 1000;

  constructor(
    @inject(CANDLE_PERSISTENCE_TYPES.FileStoragePort)
    private readonly fileStorage: FileStoragePort,
    @inject(CANDLE_PERSISTENCE_TYPES.HierarchicalStorageConfig)
    private readonly config: HierarchicalStorageConfig
  ) {
    this.partitionStrategy = new TimeframePartitionStrategy();
    this.indexManager = new IndexManager(fileStorage);
    this.metadataManager = new MetadataManager(fileStorage);
  }

  /**
   * Save a single candle to storage (Append-Only)
   * O(1) operation - appends to period file without reading existing data
   */
  async save(candle: FootprintCandle): Promise<void> {
    // Validate candle
    this.validateCandle(candle);

    const exchange = candle.ex.toUpperCase();
    const symbol = candle.s.toUpperCase();
    const timeframe = candle.i;
    const timestamp = candle.t;

    // Get partition info
    const partition = this.partitionStrategy.getPartitionInfo(
      timeframe,
      timestamp
    );

    // Build paths
    const candleBasePath = this.buildBasePath(
      exchange,
      symbol,
      'candles',
      timeframe
    );
    const footprintBasePath = this.buildBasePath(
      exchange,
      symbol,
      'footprints',
      timeframe
    );

    // Create cache key for this symbol/timeframe/period combination
    const cacheKey = `${candleBasePath}/${partition.periodName}`;

    // Check in-memory cache first (prevents race conditions)
    if (this.isInCache(cacheKey, timestamp)) {
      // Already processed this timestamp recently
      return;
    }

    // Check for duplicates using index file
    const isDuplicate = await this.indexManager.isDuplicate(
      candleBasePath,
      partition.periodName,
      timestamp
    );

    if (isDuplicate) {
      // Skip duplicate - candle already exists
      this.addToCache(cacheKey, timestamp);
      return;
    }

    // Add to cache BEFORE writing to prevent race conditions
    this.addToCache(cacheKey, timestamp);

    // Extract and serialize data
    const candleData = this.extractCandleData(candle);
    const footprintData = this.extractFootprintData(candle);

    // Append to candle file
    await this.appendToFile(
      candleBasePath,
      partition.periodName,
      candleData,
      'candle'
    );

    // Append to footprint file (if has aggs data)
    if (footprintData.aggs.length > 0) {
      await this.appendToFile(
        footprintBasePath,
        partition.periodName,
        footprintData,
        'footprint'
      );
    }

    // Update indexes
    await this.indexManager.updateIndexAfterAppend(
      candleBasePath,
      partition.periodName,
      partition.pattern,
      timestamp,
      symbol,
      timeframe
    );

    if (footprintData.aggs.length > 0) {
      await this.indexManager.updateIndexAfterAppend(
        footprintBasePath,
        partition.periodName,
        partition.pattern,
        timestamp,
        symbol,
        timeframe
      );
    }

    // Update metadata (if enabled)
    if (this.config.autoUpdateMetadata !== false) {
      await this.metadataManager.updateMetadata(
        candleBasePath,
        exchange,
        symbol,
        timeframe,
        partition.pattern,
        'candle'
      );

      if (footprintData.aggs.length > 0) {
        await this.metadataManager.updateMetadata(
          footprintBasePath,
          exchange,
          symbol,
          timeframe,
          partition.pattern,
          'footprint'
        );
      }
    }
  }

  /**
   * Check if timestamp is in recent cache
   */
  private isInCache(cacheKey: string, timestamp: number): boolean {
    const timestamps = this.recentTimestamps.get(cacheKey);
    return timestamps?.has(timestamp) ?? false;
  }

  /**
   * Add timestamp to cache
   */
  private addToCache(cacheKey: string, timestamp: number): void {
    let timestamps = this.recentTimestamps.get(cacheKey);
    if (!timestamps) {
      timestamps = new Set<number>();
      this.recentTimestamps.set(cacheKey, timestamps);
    }
    timestamps.add(timestamp);

    // Cleanup old entries if cache is too large
    if (timestamps.size > this.MAX_CACHE_SIZE) {
      // Remove oldest entries (first half)
      const arr = Array.from(timestamps).sort((a, b) => a - b);
      const toRemove = arr.slice(0, arr.length / 2);
      for (const t of toRemove) {
        timestamps.delete(t);
      }
    }
  }

  /**
   * Save multiple candles (batch operation)
   * Processes sequentially to maintain order
   */
  async saveMany(candles: FootprintCandle[]): Promise<void> {
    for (const candle of candles) {
      await this.save(candle);
    }
  }

  /**
   * Find candles by symbol, exchange, and timeframe
   * Reads from candles/ directory only (OHLCV data)
   */
  async findBySymbol(
    symbol: string,
    exchange: string,
    timeframe: string,
    options?: {
      startTime?: number;
      endTime?: number;
      limit?: number;
    }
  ): Promise<FootprintCandle[]> {
    const basePath = this.buildBasePath(
      exchange.toUpperCase(),
      symbol.toUpperCase(),
      'candles',
      timeframe
    );

    // List all period files
    const files = await this.fileStorage.listFiles(basePath, '.bin');
    if (files.length === 0) {
      return [];
    }

    // Extract period names and filter by time range
    const periods = files.map((f) => f.replace('.bin', ''));
    const filteredPeriods = await this.indexManager.filterPeriodsByTimeRange(
      basePath,
      periods,
      options?.startTime,
      options?.endTime
    );

    // Read candles from filtered periods
    const allCandles: FootprintCandle[] = [];

    for (const period of filteredPeriods.sort()) {
      const candles = await this.readCandlesFromPeriod(basePath, period);

      // Filter by time range
      const filtered = candles.filter((c) => {
        if (options?.startTime && c.t < options.startTime) return false;
        if (options?.endTime && c.t > options.endTime) return false;
        return true;
      });

      allCandles.push(...filtered);

      // Check limit
      if (options?.limit && allCandles.length >= options.limit) {
        return allCandles.slice(0, options.limit);
      }
    }

    return allCandles;
  }

  /**
   * Find candles with footprint data
   * Joins candle and footprint data by timestamp
   */
  async findWithFootprint(
    symbol: string,
    exchange: string,
    timeframe: string,
    options?: {
      startTime?: number;
      endTime?: number;
      limit?: number;
    }
  ): Promise<FootprintCandle[]> {
    // First get candles
    const candles = await this.findBySymbol(
      symbol,
      exchange,
      timeframe,
      options
    );

    if (candles.length === 0) {
      return [];
    }

    // Build footprint path
    const footprintBasePath = this.buildBasePath(
      exchange.toUpperCase(),
      symbol.toUpperCase(),
      'footprints',
      timeframe
    );

    // Create timestamp -> candle map for joining
    const candleMap = new Map<number, FootprintCandle>();
    for (const candle of candles) {
      candleMap.set(candle.t, candle);
    }

    // Get time range from candles
    const timestamps = candles.map((c) => c.t);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    // List footprint files
    const files = await this.fileStorage.listFiles(footprintBasePath, '.bin');
    if (files.length === 0) {
      return candles; // Return candles without footprint data
    }

    // Filter periods by time range
    const periods = files.map((f) => f.replace('.bin', ''));
    const filteredPeriods = await this.indexManager.filterPeriodsByTimeRange(
      footprintBasePath,
      periods,
      minTime,
      maxTime
    );

    // Read footprints and join with candles
    for (const period of filteredPeriods) {
      const footprints = await this.readFootprintsFromPeriod(
        footprintBasePath,
        period
      );

      for (const fp of footprints) {
        const candle = candleMap.get(fp.t);
        if (candle) {
          // Merge footprint data into candle
          candle.aggs = fp.aggs;
          candle.tv = fp.tv;
        }
      }
    }

    return candles;
  }

  /**
   * Find the latest candle for a symbol
   */
  async findLatest(
    symbol: string,
    exchange: string,
    timeframe: string
  ): Promise<FootprintCandle | null> {
    const basePath = this.buildBasePath(
      exchange.toUpperCase(),
      symbol.toUpperCase(),
      'candles',
      timeframe
    );

    // Get all indexes to find latest period
    const indexes = await this.indexManager.getAllIndexes(basePath);
    if (indexes.length === 0) {
      return null;
    }

    // Find period with latest timestamp
    const latestIndex = indexes.reduce((latest, current) =>
      current.lastTimestamp > latest.lastTimestamp ? current : latest
    );

    // Read candles from latest period
    const candles = await this.readCandlesFromPeriod(
      basePath,
      latestIndex.period
    );

    if (candles.length === 0) {
      return null;
    }

    // Return candle with latest timestamp
    return candles.reduce((latest, current) =>
      current.t > latest.t ? current : latest
    );
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Build base path for a data type
   * Note: Does not include baseDir as FileStoragePort handles that
   */
  private buildBasePath(
    exchange: string,
    symbol: string,
    dataType: 'candles' | 'footprints',
    timeframe: string
  ): string {
    return `${exchange}/${symbol}/${dataType}/${timeframe}`;
  }

  /**
   * Append data to period file (O(1) operation)
   */
  private async appendToFile(
    basePath: string,
    periodName: string,
    data: CandleData | FootprintData,
    schema: 'candle' | 'footprint'
  ): Promise<void> {
    const filePath = `${basePath}/${periodName}.bin`;

    // Serialize data to JSON (simple format for now)
    // TODO: Replace with FlatBuffer serialization in Task 9
    const serialized = Buffer.from(JSON.stringify(data) + '\n', 'utf-8');

    // Check if file exists
    const exists = await this.fileStorage.exists(filePath);

    if (!exists) {
      // Create new file with header (count starts at 0, will be incremented after append)
      const header = this.createFileHeader(data, schema);
      await this.fileStorage.ensureDirectory(basePath);
      await this.fileStorage.writeFile(filePath, header);
    }

    // Append serialized data
    await this.fileStorage.appendFile(filePath, serialized);

    // Update header with new count and timestamp
    await this.updateFileHeader(filePath, data);
  }

  /**
   * Create file header for new period file
   */
  private createFileHeader(
    data: CandleData | FootprintData,
    _schema: 'candle' | 'footprint'
  ): Buffer {
    const header = Buffer.alloc(PERIOD_FILE_HEADER_SIZE);
    let offset = 0;

    // Magic bytes (4 bytes)
    header.write(PERIOD_FILE_MAGIC, offset, 4, 'ascii');
    offset += 4;

    // Version (2 bytes)
    header.writeUInt16LE(PERIOD_FILE_VERSION, offset);
    offset += 2;

    // Record size (2 bytes) - 0 for variable size
    header.writeUInt16LE(0, offset);
    offset += 2;

    // Candle count (4 bytes) - starts at 0, will be incremented after append
    header.writeUInt32LE(0, offset);
    offset += 4;

    // First timestamp (8 bytes)
    header.writeBigInt64LE(BigInt(data.t), offset);
    offset += 8;

    // Last timestamp (8 bytes)
    header.writeBigInt64LE(BigInt(data.t), offset);
    offset += 8;

    // Symbol (16 bytes)
    const symbolBuffer = Buffer.alloc(16);
    symbolBuffer.write(data.s.substring(0, 16), 0, 'utf-8');
    symbolBuffer.copy(header, offset);
    offset += 16;

    // Interval (8 bytes)
    const intervalBuffer = Buffer.alloc(8);
    intervalBuffer.write(data.i.substring(0, 8), 0, 'utf-8');
    intervalBuffer.copy(header, offset);
    offset += 8;

    // Reserved (12 bytes) - already zeroed

    return header;
  }

  /**
   * Update file header after appending data
   */
  private async updateFileHeader(
    filePath: string,
    data: CandleData | FootprintData
  ): Promise<void> {
    // Read current header
    const headerBuffer = await this.fileStorage.readFileRange(
      filePath,
      0,
      PERIOD_FILE_HEADER_SIZE
    );

    if (!headerBuffer) {
      return;
    }

    // Increment count
    const currentCount = headerBuffer.readUInt32LE(8);
    headerBuffer.writeUInt32LE(currentCount + 1, 8);

    // Update last timestamp
    headerBuffer.writeBigInt64LE(BigInt(data.t), 20);

    // Update first timestamp if this is smaller
    const firstTimestamp = Number(headerBuffer.readBigInt64LE(12));
    if (data.t < firstTimestamp || firstTimestamp === data.t) {
      // Keep first timestamp as is for first record, update only if smaller
      if (currentCount > 0 && data.t < firstTimestamp) {
        headerBuffer.writeBigInt64LE(BigInt(data.t), 12);
      }
    }

    // Write updated header
    await this.fileStorage.writeFileRange(filePath, 0, headerBuffer);
  }

  /**
   * Read candles from a period file
   */
  private async readCandlesFromPeriod(
    basePath: string,
    periodName: string
  ): Promise<FootprintCandle[]> {
    const filePath = `${basePath}/${periodName}.bin`;
    const buffer = await this.fileStorage.readFile(filePath);

    if (!buffer) {
      return [];
    }

    // Skip header and parse JSON lines
    const content = buffer.subarray(PERIOD_FILE_HEADER_SIZE).toString('utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    const candles: FootprintCandle[] = [];

    for (const line of lines) {
      try {
        const data = JSON.parse(line) as CandleData;
        const candle = this.candleDataToFootprintCandle(data);
        candles.push(candle);
      } catch {
        // Skip invalid lines
        continue;
      }
    }

    return candles;
  }

  /**
   * Read footprints from a period file
   */
  private async readFootprintsFromPeriod(
    basePath: string,
    periodName: string
  ): Promise<FootprintData[]> {
    const filePath = `${basePath}/${periodName}.bin`;
    const buffer = await this.fileStorage.readFile(filePath);

    if (!buffer) {
      return [];
    }

    // Skip header and parse JSON lines
    const content = buffer.subarray(PERIOD_FILE_HEADER_SIZE).toString('utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    const footprints: FootprintData[] = [];

    for (const line of lines) {
      try {
        const data = JSON.parse(line) as FootprintData;
        footprints.push(data);
      } catch {
        // Skip invalid lines
        continue;
      }
    }

    return footprints;
  }

  /**
   * Extract CandleData from FootprintCandle
   */
  private extractCandleData(candle: FootprintCandle): CandleData {
    return {
      t: candle.t,
      ct: candle.ct,
      s: candle.s,
      i: candle.i,
      o: candle.o,
      h: candle.h,
      l: candle.l,
      c: candle.c,
      v: candle.v,
      bv: candle.bv,
      sv: candle.sv,
      q: candle.q,
      bq: candle.bq,
      sq: candle.sq,
      d: candle.d,
      dMax: candle.dMax,
      dMin: candle.dMin,
      n: candle.n,
    };
  }

  /**
   * Extract FootprintData from FootprintCandle
   */
  private extractFootprintData(candle: FootprintCandle): FootprintData {
    return {
      t: candle.t,
      ct: candle.ct,
      s: candle.s,
      i: candle.i,
      n: candle.n,
      tv: candle.tv,
      aggs: candle.aggs.map((agg) => ({
        tp: agg.tp,
        v: agg.v,
        bv: agg.bv,
        sv: agg.sv,
        bq: agg.bq ?? 0,
        sq: agg.sq ?? 0,
      })),
    };
  }

  /**
   * Convert CandleData back to FootprintCandle
   */
  private candleDataToFootprintCandle(data: CandleData): FootprintCandle {
    // Create a minimal FootprintCandle-like object
    // Note: This returns candle without footprint data (aggs)
    return {
      e: 'CANDLESTICK',
      tz: 'UTC',
      ex: '', // Will be set from path context
      a: '',
      s: data.s,
      i: data.i,
      vi: this.getIntervalSeconds(data.i),
      t: data.t,
      o: data.o,
      h: data.h,
      l: data.l,
      c: data.c,
      ct: data.ct,
      v: data.v,
      bv: data.bv,
      sv: data.sv,
      q: data.q,
      bq: data.bq,
      sq: data.sq,
      n: data.n,
      f: 0,
      ls: 0,
      d: data.d,
      dMax: data.dMax,
      dMin: data.dMin,
      tv: 0,
      aggs: [],
      x: true,
    } as unknown as FootprintCandle;
  }

  /**
   * Get interval in seconds from timeframe string
   */
  private getIntervalSeconds(interval: string): number {
    const map: Record<string, number> = {
      '1m': 60,
      '3m': 180,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '2h': 7200,
      '4h': 14400,
      '8h': 28800,
      '12h': 43200,
      '1d': 86400,
    };
    return map[interval] ?? 60;
  }

  /**
   * Validate candle data before saving
   */
  private validateCandle(candle: FootprintCandle): void {
    if (!candle.s) {
      throw new Error('Candle must have a symbol');
    }
    if (!candle.i) {
      throw new Error('Candle must have an interval');
    }
    if (!candle.t || candle.t <= 0) {
      throw new Error('Candle must have a valid timestamp');
    }
    if (!candle.x) {
      throw new Error('Only complete candles can be saved');
    }
  }
}
