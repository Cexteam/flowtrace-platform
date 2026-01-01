/**
 * Binary Storage Adapter
 * Implements CandleStoragePort interface using binary file storage.
 * Efficiently stores footprint candles in .ftcd files.
 * This adapter is a thin wrapper that delegates to shared infrastructure components:
 * - FileManager: File I/O operations
 * - PathResolver: Path generation logic
 * - CandleCache: In-memory caching with dirty tracking
 * - BinarySerializer: Binary serialization/deserialization
 */

import { injectable, inject } from 'inversify';
import type { CandleStoragePort } from '../../application/ports/out/CandleStoragePort.js';
import { FootprintCandle, Timeframe } from '@flowtrace/core';
import type { Aggs } from '@flowtrace/core';

// Import shared infrastructure components
import { FileManager } from '../../../../infrastructure/storage/file/FileManager.js';
import { PathResolver } from '../../../../infrastructure/storage/file/PathResolver.js';
import { CandleCache } from '../../../../infrastructure/storage/cache/CandleCache.js';
import { BinarySerializer } from '../../../../infrastructure/storage/serialization/binary/BinarySerializer.js';
import type {
  BinaryCandle,
  BinaryAggs,
  BinaryPriceBin,
  CandleFile,
  CandleBlock,
} from '../../../../infrastructure/storage/serialization/binary/schemas/types.js';
import { CANDLE_PERSISTENCE_TYPES } from '../../di/types.js';

export interface BinaryStorageConfig {
  baseDir: string;
  maxCandlesPerBlock?: number;
  maxCacheEntries?: number;
}

@injectable()
export class BinaryStorageAdapter implements CandleStoragePort {
  private readonly maxCandlesPerBlock: number;
  private readonly fileManager: FileManager;
  private readonly pathResolver: PathResolver;
  private readonly cache: CandleCache;

  constructor(
    @inject(CANDLE_PERSISTENCE_TYPES.StorageConfig)
    config: BinaryStorageConfig
  ) {
    this.maxCandlesPerBlock = config.maxCandlesPerBlock ?? 1000;

    // Initialize shared infrastructure components
    this.fileManager = new FileManager({ baseDir: config.baseDir });
    this.pathResolver = new PathResolver({
      baseDir: config.baseDir,
      candlesSubdir: 'candles',
      extension: BinarySerializer.getExtension('candle'),
    });
    this.cache = new CandleCache({ maxEntries: config.maxCacheEntries });

    // Ensure candles directory exists
    this.fileManager.ensureDirectory(this.pathResolver.getCandlesDirectory());
  }

  // ============================================================================
  // Private Helper Methods - Delegating to Shared Components
  // ============================================================================

  /**
   * Load candles from file into cache
   * Delegates to: FileManager (file I/O), PathResolver (path), CandleCache (caching)
   */
  private async loadFromFile(
    symbol: string,
    exchange: string,
    timeframe: string
  ): Promise<FootprintCandle[]> {
    const cacheKey = this.pathResolver.getCacheKey(symbol, exchange, timeframe);

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const filePath = this.pathResolver.getFilePath(symbol, exchange, timeframe);

    // Use FileManager to read file
    const buffer = this.fileManager.readFileOrNull(filePath);
    if (!buffer) {
      this.cache.set(cacheKey, []);
      return [];
    }

    try {
      // Use BinarySerializer to deserialize
      const candleFile = BinarySerializer.deserialize<CandleFile>(
        buffer,
        'candle'
      );

      const candles: FootprintCandle[] = [];
      for (const block of candleFile.blocks) {
        for (const bc of block.candles) {
          candles.push(this.binaryToDomain(bc));
        }
      }

      this.cache.set(cacheKey, candles);
      console.log(`Loaded ${candles.length} candles from ${filePath}`);
      return candles;
    } catch (error) {
      console.error(`Failed to load candles from ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Save candles from cache to file
   * Delegates to: FileManager (file I/O), PathResolver (path), CandleCache (caching), BinarySerializer (serialization)
   */
  private async saveToFile(
    symbol: string,
    exchange: string,
    timeframe: string
  ): Promise<void> {
    const cacheKey = this.pathResolver.getCacheKey(symbol, exchange, timeframe);
    const candles = this.cache.get(cacheKey) || [];

    if (candles.length === 0) {
      return;
    }

    const filePath = this.pathResolver.getFilePath(symbol, exchange, timeframe);

    // Group candles into blocks
    const blocks: CandleBlock[] = [];
    for (let i = 0; i < candles.length; i += this.maxCandlesPerBlock) {
      const blockCandles = candles.slice(i, i + this.maxCandlesPerBlock);
      if (blockCandles.length > 0) {
        blocks.push({
          symbol,
          exchange,
          timeframe,
          startTime: blockCandles[0]!.t,
          endTime: blockCandles[blockCandles.length - 1]!.t,
          candles: blockCandles.map((c) => this.domainToBinary(c)),
        });
      }
    }

    const candleFile: CandleFile = {
      version: 1,
      symbol,
      exchange,
      timeframe,
      createdAt: Date.now(),
      blocks,
    };

    try {
      // Use BinarySerializer to serialize
      const buffer = BinarySerializer.serialize(candleFile, 'candle');
      // Use FileManager to write file
      this.fileManager.writeFile(filePath, buffer);
      // Mark cache entry as clean
      this.cache.markClean(cacheKey);
      console.log(`Saved ${candles.length} candles to ${filePath}`);
    } catch (error) {
      console.error(`Failed to save candles to ${filePath}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // Domain Conversion Methods
  // ============================================================================

  private binaryToDomain(bc: BinaryCandle | any): FootprintCandle {
    // Handle both BinaryCandle format (symbol, exchange) and FootprintCandleData format (s, ex)
    const symbol = bc.symbol ?? bc.s;
    const exchange = bc.exchange ?? bc.ex;
    const timeframe = bc.timeframe ?? bc.i;
    const tickValue = bc.tickValue ?? bc.tv ?? 0.01;

    const candle = new FootprintCandle(
      symbol,
      new Timeframe(timeframe),
      tickValue,
      exchange
    );

    candle.t = bc.openTime ?? bc.t;
    candle.ct = bc.closeTime ?? bc.ct;
    candle.o = bc.open ?? bc.o ?? 0;
    candle.h = bc.high ?? bc.h ?? 0;
    candle.l = bc.low ?? bc.l ?? 0;
    candle.c = bc.close ?? bc.c ?? 0;
    candle.v = bc.volume ?? bc.v ?? 0;
    candle.bv = bc.buyVolume ?? bc.bv ?? 0;
    candle.sv = bc.sellVolume ?? bc.sv ?? 0;
    candle.q = bc.quoteVolume ?? bc.q ?? 0;
    candle.bq = bc.buyQuoteVolume ?? bc.bq ?? 0;
    candle.sq = bc.sellQuoteVolume ?? bc.sq ?? 0;
    candle.n = bc.tradeCount ?? bc.n ?? 0;
    candle.d = bc.delta ?? bc.d ?? 0;
    candle.dMax = bc.deltaMax ?? bc.dMax ?? 0;
    candle.dMin = bc.deltaMin ?? bc.dMin ?? 0;
    candle.f = bc.firstTradeId ?? bc.f ?? 0;
    candle.ls = bc.lastTradeId ?? bc.ls ?? 0;
    candle.x = bc.isComplete ?? bc.x ?? false;

    // Handle aggs - both formats
    if (bc.aggs && Array.isArray(bc.aggs)) {
      candle.aggs = bc.aggs.map((bin: any) => this.binaryBinToAggs(bin));
    }

    return candle;
  }

  private domainToBinary(candle: FootprintCandle): BinaryCandle {
    return {
      id: `${candle.ex}:${candle.s}:${candle.i}:${candle.t}`,
      symbol: candle.s,
      exchange: candle.ex,
      timeframe: candle.i,
      openTime: candle.t,
      closeTime: candle.ct,
      open: candle.o,
      high: candle.h,
      low: candle.l,
      close: candle.c,
      volume: candle.v,
      buyVolume: candle.bv,
      sellVolume: candle.sv,
      quoteVolume: candle.q,
      buyQuoteVolume: candle.bq,
      sellQuoteVolume: candle.sq,
      tradeCount: candle.n,
      delta: candle.d,
      deltaMax: candle.dMax,
      deltaMin: candle.dMin,
      tickValue: candle.tv,
      aggs: candle.aggs.map((agg) => this.aggsToBinaryBin(agg)),
      firstTradeId: candle.f,
      lastTradeId: candle.ls,
      isComplete: candle.x,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private binaryBinToAggs(bin: BinaryPriceBin | BinaryAggs): Aggs {
    // Handle BinaryAggs (new format)
    if ('tp' in bin) {
      return {
        tp: bin.tp,
        bv: bin.bv,
        sv: bin.sv,
        v: bin.v,
        bq: bin.bq,
        sq: bin.sq,
        q: bin.bq + bin.sq,
      };
    }
    // Handle BinaryPriceBin (legacy format)
    return {
      tp: bin.price,
      bv: bin.buyVolume,
      sv: bin.sellVolume,
      v: bin.buyVolume + bin.sellVolume,
      bq: bin.buyQuote || 0,
      sq: bin.sellQuote || 0,
      q: (bin.buyQuote || 0) + (bin.sellQuote || 0),
    };
  }

  private aggsToBinaryBin(agg: Aggs): BinaryPriceBin {
    return {
      price: agg.tp,
      buyVolume: agg.bv,
      sellVolume: agg.sv,
      buyCount: 0, // Not available in Aggs
      sellCount: 0, // Not available in Aggs
      delta: agg.bv - agg.sv,
    };
  }

  // ============================================================================
  // CandleStoragePort Interface Implementation
  // ============================================================================

  async save(candle: FootprintCandle): Promise<void> {
    const cacheKey = this.pathResolver.getCacheKey(
      candle.s,
      candle.ex,
      candle.i
    );
    await this.loadFromFile(candle.s, candle.ex, candle.i);

    // Use CandleCache to upsert candle
    this.cache.upsertCandle(cacheKey, candle);

    // Auto-save
    await this.saveToFile(candle.s, candle.ex, candle.i);
  }

  async saveMany(candleEntities: FootprintCandle[]): Promise<void> {
    if (candleEntities.length === 0) return;

    // Group by symbol/exchange/timeframe using PathResolver
    const grouped = new Map<string, FootprintCandle[]>();
    for (const candle of candleEntities) {
      const key = this.pathResolver.getCacheKey(candle.s, candle.ex, candle.i);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(candle);
    }

    // Save each group
    for (const [key, groupCandles] of grouped) {
      const parsed = this.pathResolver.parseCacheKey(key);
      if (!parsed) continue;

      const { exchange, symbol, timeframe } = parsed;
      await this.loadFromFile(symbol, exchange, timeframe);

      // Use CandleCache to upsert candles
      this.cache.upsertCandles(key, groupCandles);

      await this.saveToFile(symbol, exchange, timeframe);
    }

    console.log(`Bulk saved ${candleEntities.length} candles`);
  }

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
    await this.loadFromFile(symbol, exchange, timeframe);

    const cacheKey = this.pathResolver.getCacheKey(symbol, exchange, timeframe);

    // Use CandleCache to filter by time range
    let candles = this.cache.filterByTimeRange(
      cacheKey,
      options?.startTime,
      options?.endTime
    );

    // Sort by open time descending
    candles.sort((a, b) => b.t - a.t);

    if (options?.limit !== undefined) {
      candles = candles.slice(0, options.limit);
    }

    return candles;
  }

  async findLatest(
    symbol: string,
    exchange: string,
    timeframe: string
  ): Promise<FootprintCandle | null> {
    await this.loadFromFile(symbol, exchange, timeframe);

    const cacheKey = this.pathResolver.getCacheKey(symbol, exchange, timeframe);

    // Use CandleCache to find latest
    return this.cache.findLatest(cacheKey);
  }

  /**
   * Flush all dirty data to disk
   */
  async flush(): Promise<void> {
    // Use CandleCache to get dirty keys
    for (const key of this.cache.getDirtyKeys()) {
      const parsed = this.pathResolver.parseCacheKey(key);
      if (!parsed) continue;

      const { exchange, symbol, timeframe } = parsed;
      await this.saveToFile(symbol, exchange, timeframe);
    }
  }
}
