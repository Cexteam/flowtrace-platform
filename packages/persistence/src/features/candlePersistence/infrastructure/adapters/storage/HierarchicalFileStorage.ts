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
 * - FlatBuffer + LZ4 compression for storage efficiency
 */

import { injectable, inject, optional } from 'inversify';
import type { FootprintCandle } from '@flowtrace/core';
import type { CandleStoragePort } from '../../../application/ports/out/CandleStoragePort.js';
import type { FileStoragePort } from '../../../application/ports/out/FileStoragePort.js';
import type { CompressedCandleSerializerPort } from '../../../application/ports/out/CompressedCandleSerializerPort.js';
import type { CandleOnlyData } from '../../../../../infrastructure/storage/serialization/flatbuffer/FlatBufferCandleOnlySerializer.js';
import type { FootprintOnlyData } from '../../../../../infrastructure/storage/serialization/flatbuffer/FlatBufferFootprintOnlySerializer.js';
import { CANDLE_PERSISTENCE_TYPES } from '../../../di/types.js';
import {
  type CandleData,
  type FootprintData,
  type HierarchicalStorageConfig,
  PERIOD_FILE_HEADER_SIZE,
  PERIOD_FILE_MAGIC,
  PERIOD_FILE_VERSION,
} from '../../../../../infrastructure/storage/hierarchical/types.js';
import { TimeframePartitionStrategy } from '../../../../../infrastructure/storage/hierarchical/services/TimeframePartitionStrategy.js';
import { IndexManager } from '../../../../../infrastructure/storage/hierarchical/services/IndexManager.js';
import { MetadataManager } from '../../../../../infrastructure/storage/hierarchical/services/MetadataManager.js';

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
    private readonly config: HierarchicalStorageConfig,
    @inject(CANDLE_PERSISTENCE_TYPES.CompressedCandleSerializerPort)
    @optional()
    private readonly serializer?: CompressedCandleSerializerPort
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
   * Uses length-prefixed records with optimized formats:
   * - FTCO for candle data (OHLCV without footprint)
   * - FTFO for footprint data (aggregations without OHLCV)
   */
  private async appendToFile(
    basePath: string,
    periodName: string,
    data: CandleData | FootprintData,
    schema: 'candle' | 'footprint'
  ): Promise<void> {
    const filePath = `${basePath}/${periodName}.bin`;

    // Serialize data using optimized formats if serializer available
    let serialized: Buffer;
    if (this.serializer) {
      if (schema === 'candle') {
        // Use FTCO format for candle data (optimized, no footprint fields)
        const candleOnlyData = this.toCandleOnlyData(data as CandleData);
        const result = this.serializer.serializeCandleOnly(candleOnlyData);
        // Length-prefixed record: [4 bytes length][FTCO data]
        const lengthBuffer = Buffer.alloc(4);
        lengthBuffer.writeUInt32LE(result.buffer.length, 0);
        serialized = Buffer.concat([lengthBuffer, result.buffer]);
      } else {
        // Use FTFO format for footprint data (optimized, no OHLCV fields)
        const footprintOnlyData = this.toFootprintOnlyData(
          data as FootprintData
        );
        const result =
          this.serializer.serializeFootprintOnly(footprintOnlyData);
        // Length-prefixed record: [4 bytes length][FTFO data]
        const lengthBuffer = Buffer.alloc(4);
        lengthBuffer.writeUInt32LE(result.buffer.length, 0);
        serialized = Buffer.concat([lengthBuffer, result.buffer]);
      }
    } else {
      // Fallback to JSON (legacy format)
      serialized = Buffer.from(JSON.stringify(data) + '\n', 'utf-8');
    }

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
   * Convert CandleData to CandleOnlyData for FTCO serialization
   */
  private toCandleOnlyData(data: CandleData): CandleOnlyData {
    return {
      t: data.t,
      ct: data.ct,
      s: data.s,
      i: data.i,
      o: data.o,
      h: data.h,
      l: data.l,
      c: data.c,
      v: data.v,
      bv: data.bv,
      sv: data.sv,
      q: data.q,
      bq: data.bq,
      sq: data.sq,
      d: data.d,
      dMax: data.dMax,
      dMin: data.dMin,
      n: data.n,
    };
  }

  /**
   * Convert FootprintData to FootprintOnlyData for FTFO serialization
   */
  private toFootprintOnlyData(data: FootprintData): FootprintOnlyData {
    return {
      t: data.t,
      ct: data.ct,
      s: data.s,
      i: data.i,
      n: data.n,
      tv: data.tv,
      bm: data.bm,
      aggs: data.aggs.map((agg) => ({
        tp: agg.tp,
        v: agg.v,
        bv: agg.bv,
        sv: agg.sv,
        bq: agg.bq,
        sq: agg.sq,
      })),
    };
  }

  /**
   * Convert CandleData or FootprintData to FootprintCandle for serialization
   * @deprecated Use toCandleOnlyData or toFootprintOnlyData instead
   */
  private dataToFootprintCandle(
    data: CandleData | FootprintData,
    schema: 'candle' | 'footprint'
  ): FootprintCandle {
    if (schema === 'candle') {
      const candleData = data as CandleData;
      return {
        e: 'CANDLESTICK',
        tz: 'UTC',
        ex: '',
        a: '',
        s: candleData.s,
        i: candleData.i,
        vi: this.getIntervalSeconds(candleData.i),
        t: candleData.t,
        ct: candleData.ct,
        o: candleData.o,
        h: candleData.h,
        l: candleData.l,
        c: candleData.c,
        v: candleData.v,
        bv: candleData.bv,
        sv: candleData.sv,
        q: candleData.q,
        bq: candleData.bq,
        sq: candleData.sq,
        n: candleData.n,
        f: 0,
        ls: 0,
        d: candleData.d,
        dMax: candleData.dMax,
        dMin: candleData.dMin,
        tv: 0,
        bm: 1,
        aggs: [],
        x: true,
      } as unknown as FootprintCandle;
    } else {
      const footprintData = data as FootprintData;
      return {
        e: 'CANDLESTICK',
        tz: 'UTC',
        ex: '',
        a: '',
        s: footprintData.s,
        i: footprintData.i,
        vi: this.getIntervalSeconds(footprintData.i),
        t: footprintData.t,
        ct: footprintData.ct,
        o: 0,
        h: 0,
        l: 0,
        c: 0,
        v: 0,
        bv: 0,
        sv: 0,
        q: 0,
        bq: 0,
        sq: 0,
        n: footprintData.n,
        f: 0,
        ls: 0,
        d: 0,
        dMax: 0,
        dMin: 0,
        tv: footprintData.tv,
        bm: footprintData.bm,
        aggs: footprintData.aggs,
        x: true,
      } as unknown as FootprintCandle;
    }
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
   * Supports FTCO (optimized), FTCF (legacy), and JSON formats
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

    // Skip header
    let offset = PERIOD_FILE_HEADER_SIZE;
    const candles: FootprintCandle[] = [];

    // Detect format: Check first bytes after header
    if (buffer.length > offset + 4) {
      const firstByte = buffer[offset];

      if (firstByte === 0x7b) {
        // Legacy JSON format (starts with '{')
        const content = buffer.subarray(offset).toString('utf-8');
        const lines = content.split('\n').filter((line) => line.trim());

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
      } else if (this.serializer) {
        // Length-prefixed binary format (FTCO or FTCF)
        while (offset + 4 <= buffer.length) {
          const recordLength = buffer.readUInt32LE(offset);
          offset += 4;

          if (offset + recordLength > buffer.length) {
            // Truncated record, stop reading
            break;
          }

          const recordBuffer = buffer.subarray(offset, offset + recordLength);
          offset += recordLength;

          try {
            // Detect format by magic bytes
            const magic = recordBuffer.subarray(0, 4).toString('ascii');

            if (magic === 'FTCO') {
              // FTCO format (optimized CandleOnly)
              const result =
                this.serializer.deserializeCandleOnly(recordBuffer);
              const candle = this.candleOnlyDataToFootprintCandle(result.data);
              candles.push(candle);
            } else if (magic === 'FTCF') {
              // FTCF format (legacy full FootprintCandle)
              const result = this.serializer.deserialize(recordBuffer);
              candles.push(result.candle);
            } else {
              console.error('Unknown magic bytes:', magic);
              continue;
            }
          } catch (error) {
            // Skip invalid records
            console.error('Failed to deserialize record:', error);
            continue;
          }
        }
      }
    }

    return candles;
  }

  /**
   * Convert CandleOnlyData to FootprintCandle
   */
  private candleOnlyDataToFootprintCandle(
    data: CandleOnlyData
  ): FootprintCandle {
    return {
      e: 'CANDLESTICK',
      tz: 'UTC',
      ex: '',
      a: '',
      s: data.s,
      i: data.i,
      vi: this.getIntervalSeconds(data.i),
      t: data.t,
      ct: data.ct,
      o: data.o,
      h: data.h,
      l: data.l,
      c: data.c,
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
      bm: 1,
      aggs: [],
      x: true,
    } as unknown as FootprintCandle;
  }

  /**
   * Read footprints from a period file
   * Supports FTFO (optimized), FTCF (legacy), and JSON formats
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

    // Skip header
    let offset = PERIOD_FILE_HEADER_SIZE;
    const footprints: FootprintData[] = [];

    // Detect format
    if (buffer.length > offset + 4) {
      const firstByte = buffer[offset];

      if (firstByte === 0x7b) {
        // Legacy JSON format
        const content = buffer.subarray(offset).toString('utf-8');
        const lines = content.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line) as FootprintData;
            footprints.push(data);
          } catch {
            // Skip invalid lines
            continue;
          }
        }
      } else if (this.serializer) {
        // Length-prefixed binary format (FTFO or FTCF)
        while (offset + 4 <= buffer.length) {
          const recordLength = buffer.readUInt32LE(offset);
          offset += 4;

          if (offset + recordLength > buffer.length) {
            break;
          }

          const recordBuffer = buffer.subarray(offset, offset + recordLength);
          offset += recordLength;

          try {
            // Detect format by magic bytes
            const magic = recordBuffer.subarray(0, 4).toString('ascii');

            if (magic === 'FTFO') {
              // FTFO format (optimized FootprintOnly)
              const result =
                this.serializer.deserializeFootprintOnly(recordBuffer);
              footprints.push(result.data);
            } else if (magic === 'FTCF') {
              // FTCF format (legacy full FootprintCandle)
              const result = this.serializer.deserialize(recordBuffer);
              const candle = result.candle;
              footprints.push({
                t: candle.t,
                ct: candle.ct,
                s: candle.s,
                i: candle.i,
                n: candle.n,
                tv: candle.tv,
                bm: candle.bm,
                aggs: candle.aggs.map((agg) => ({
                  tp: agg.tp,
                  v: agg.v,
                  bv: agg.bv,
                  sv: agg.sv,
                  bq: agg.bq ?? 0,
                  sq: agg.sq ?? 0,
                })),
              });
            } else {
              console.error('Unknown magic bytes:', magic);
              continue;
            }
          } catch (error) {
            console.error('Failed to deserialize footprint record:', error);
            continue;
          }
        }
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
      bm: candle.bm,
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
