/**
 * Storage Migrator
 * Migrates candle data from file-based storage to SQLite database storage.
 * Provides batch processing, data validation, and progress reporting.
 */

import * as fs from 'fs';
import * as path from 'path';
import { injectable } from 'inversify';
import { FootprintCandle } from '@flowtrace/core';
import type { CandleStoragePort } from '../../features/candlePersistence/application/ports/out/CandleStoragePort.js';
import { BinarySerializer } from '../storage/serialization/binary/BinarySerializer.js';
import type {
  CandleFile,
  BinaryCandle,
  BinaryAggs,
  BinaryPriceBin,
} from '../storage/serialization/binary/schemas/types.js';
import { Timeframe } from '@flowtrace/core';
import type { Aggs } from '@flowtrace/core';

export interface MigrationConfig {
  /** Source directory containing .ftcd files */
  sourceDir: string;

  /** Target storage adapter (SQLite-based) */
  targetStorage: CandleStoragePort;

  /** Batch size for processing candles (default: 1000) */
  batchSize?: number;

  /** Maximum memory usage in MB (default: 512) */
  maxMemoryMB?: number;

  /** Enable detailed logging (default: false) */
  verbose?: boolean;

  /** Dry run mode - validate without migrating (default: false) */
  dryRun?: boolean;

  /** Continue from previous migration attempt (default: false) */
  resume?: boolean;

  /** Checkpoint file for resumable migration */
  checkpointFile?: string;
}

export interface CandleFileInfo {
  /** File path */
  filePath: string;

  /** Exchange name */
  exchange: string;

  /** Symbol name */
  symbol: string;

  /** Timeframe */
  timeframe: string;

  /** File size in bytes */
  fileSize: number;

  /** Number of candles in file */
  candleCount: number;

  /** Last modified timestamp */
  lastModified: number;
}

export interface MigrationProgress {
  /** Total files to process */
  totalFiles: number;

  /** Files processed */
  processedFiles: number;

  /** Total candles to migrate */
  totalCandles: number;

  /** Candles migrated */
  migratedCandles: number;

  /** Current file being processed */
  currentFile?: string;

  /** Migration start time */
  startTime: number;

  /** Estimated completion time */
  estimatedCompletion?: number;

  /** Current memory usage in MB */
  memoryUsageMB: number;

  /** Errors encountered */
  errors: string[];

  /** Warnings encountered */
  warnings: string[];
}

export interface MigrationResult {
  /** Migration success status */
  success: boolean;

  /** Migration progress */
  progress: MigrationProgress;

  /** Total migration time in milliseconds */
  duration: number;

  /** Files successfully migrated */
  migratedFiles: CandleFileInfo[];

  /** Files that failed migration */
  failedFiles: Array<{ file: CandleFileInfo; error: string }>;

  /** Data integrity validation results */
  validationResults: ValidationSummary;

  /** Performance metrics */
  performance: {
    candlesPerSecond: number;
    mbPerSecond: number;
    averageBatchTime: number;
  };
}

export interface ValidationSummary {
  /** Total candles validated */
  totalCandles: number;

  /** Candles with validation errors */
  errorCount: number;

  /** Candles with warnings */
  warningCount: number;

  /** Validation success rate */
  successRate: number;

  /** Sample validation errors */
  sampleErrors: string[];
}

export interface MigrationCheckpoint {
  /** Checkpoint timestamp */
  timestamp: number;

  /** Files completed */
  completedFiles: string[];

  /** Current progress */
  progress: MigrationProgress;

  /** Configuration used */
  config: MigrationConfig;
}

/**
 * Storage Migrator
 * Handles migration of candle data from file-based storage to database storage.
 * Provides batch processing, memory management, and comprehensive validation.
 */
@injectable()
export class StorageMigrator {
  private config!: Required<MigrationConfig>;
  private progress: MigrationProgress;
  private checkpoint: MigrationCheckpoint | null = null;
  private startTime: number = 0;
  private batchTimes: number[] = [];

  constructor() {
    this.progress = this.createInitialProgress();
  }

  /**
   * Migrate candle data from files to database
   */
  async migrateFromFiles(config: MigrationConfig): Promise<MigrationResult> {
    this.config = this.normalizeConfig(config);
    this.startTime = Date.now();
    this.progress = this.createInitialProgress();

    try {
      console.log('Starting storage migration...');
      console.log(`Source: ${this.config.sourceDir}`);
      console.log(`Batch size: ${this.config.batchSize}`);
      console.log(`Max memory: ${this.config.maxMemoryMB}MB`);

      // Load checkpoint if resuming
      if (this.config.resume) {
        await this.loadCheckpoint();
      }

      // Scan source directory for candle files
      const candleFiles = await this.scanCandleFiles();
      this.progress.totalFiles = candleFiles.length;
      this.progress.totalCandles = candleFiles.reduce(
        (sum, file) => sum + file.candleCount,
        0
      );

      console.log(`Found ${candleFiles.length} candle files`);
      console.log(`Total candles to migrate: ${this.progress.totalCandles}`);

      if (this.config.dryRun) {
        console.log('Dry run mode - no data will be migrated');
        return this.createDryRunResult(candleFiles);
      }

      // Migrate files in batches
      const migratedFiles: CandleFileInfo[] = [];
      const failedFiles: Array<{ file: CandleFileInfo; error: string }> = [];

      for (const fileInfo of candleFiles) {
        // Skip if already processed (resume mode)
        if (this.checkpoint?.completedFiles.includes(fileInfo.filePath)) {
          this.progress.processedFiles++;
          migratedFiles.push(fileInfo);
          continue;
        }

        try {
          this.progress.currentFile = fileInfo.filePath;
          await this.migrateFile(fileInfo);
          migratedFiles.push(fileInfo);
          this.progress.processedFiles++;

          // Save checkpoint periodically
          if (this.progress.processedFiles % 10 === 0) {
            await this.saveCheckpoint(migratedFiles.map((f) => f.filePath));
          }

          // Check memory usage
          await this.checkMemoryUsage();
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.progress.errors.push(`${fileInfo.filePath}: ${errorMessage}`);
          failedFiles.push({ file: fileInfo, error: errorMessage });

          if (this.config.verbose) {
            console.error(`Failed to migrate ${fileInfo.filePath}:`, error);
          }
        }
      }

      // Validate migration results
      const validationResults = await this.validateMigration(migratedFiles);

      const duration = Date.now() - this.startTime;
      const result: MigrationResult = {
        success: failedFiles.length === 0,
        progress: this.progress,
        duration,
        migratedFiles,
        failedFiles,
        validationResults,
        performance: this.calculatePerformanceMetrics(duration),
      };

      // Clean up checkpoint on successful completion
      if (result.success && this.config.checkpointFile) {
        await this.cleanupCheckpoint();
      }

      console.log('Migration completed');
      console.log(`Migrated: ${migratedFiles.length} files`);
      console.log(`Failed: ${failedFiles.length} files`);
      console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);

      return result;
    } catch (error) {
      console.error('Migration failed:', error);
      const duration = Date.now() - this.startTime;

      return {
        success: false,
        progress: this.progress,
        duration,
        migratedFiles: [],
        failedFiles: [],
        validationResults: {
          totalCandles: 0,
          errorCount: 1,
          warningCount: 0,
          successRate: 0,
          sampleErrors: [
            error instanceof Error ? error.message : String(error),
          ],
        },
        performance: this.calculatePerformanceMetrics(duration),
      };
    }
  }

  /**
   * Scan source directory for candle files
   */
  private async scanCandleFiles(): Promise<CandleFileInfo[]> {
    const candlesDir = path.join(this.config.sourceDir, 'candles');

    if (!fs.existsSync(candlesDir)) {
      throw new Error(`Candles directory not found: ${candlesDir}`);
    }

    const files = fs.readdirSync(candlesDir);
    const candleFiles: CandleFileInfo[] = [];

    for (const fileName of files) {
      if (!fileName.endsWith('.ftcd')) {
        continue;
      }

      const filePath = path.join(candlesDir, fileName);
      const stats = fs.statSync(filePath);

      // Parse filename: {exchange}_{symbol}_{timeframe}.ftcd
      const baseName = path.basename(fileName, '.ftcd');
      const parts = baseName.split('_');

      if (parts.length < 3) {
        this.progress.warnings.push(`Invalid filename format: ${fileName}`);
        continue;
      }

      const exchange = parts[0]!;
      const symbol = parts.slice(1, -1).join('_'); // Handle symbols with underscores
      const timeframe = parts[parts.length - 1]!;

      // Count candles in file
      let candleCount = 0;
      try {
        const buffer = fs.readFileSync(filePath);
        const deserializedData = BinarySerializer.deserialize(buffer, 'candle');

        // Check if this is a CandleFile with blocks or a single candle
        const isObject = (val: unknown): val is Record<string, unknown> =>
          typeof val === 'object' && val !== null;

        if (
          isObject(deserializedData) &&
          'blocks' in deserializedData &&
          Array.isArray(deserializedData.blocks)
        ) {
          // CandleFile format - count all candles in all blocks
          for (const block of deserializedData.blocks) {
            if (block.candles && Array.isArray(block.candles)) {
              candleCount += block.candles.length;
            }
          }
        } else {
          // Single candle format
          candleCount = 1;
        }
      } catch (error) {
        this.progress.warnings.push(`Failed to read ${fileName}: ${error}`);
        continue;
      }

      candleFiles.push({
        filePath,
        exchange,
        symbol,
        timeframe,
        fileSize: stats.size,
        candleCount,
        lastModified: stats.mtime.getTime(),
      });
    }

    return candleFiles.sort((a, b) => a.filePath.localeCompare(b.filePath));
  }

  /**
   * Migrate a single file
   */
  private async migrateFile(fileInfo: CandleFileInfo): Promise<void> {
    const batchStartTime = Date.now();

    if (this.config.verbose) {
      console.log(
        `Migrating ${fileInfo.filePath} (${fileInfo.candleCount} candles)`
      );
    }

    // Read and deserialize file
    const buffer = fs.readFileSync(fileInfo.filePath);

    // The file contains serialized candle data
    const deserializedData = BinarySerializer.deserialize(buffer, 'candle');

    // Type guard for checking object properties safely
    const isObject = (val: unknown): val is Record<string, unknown> =>
      typeof val === 'object' && val !== null;

    if (this.config.verbose) {
      console.log('Deserialized data:', {
        type: typeof deserializedData,
        keys: isObject(deserializedData) ? Object.keys(deserializedData) : [],
        hasBlocks: isObject(deserializedData) && 'blocks' in deserializedData,
        hasSymbol: isObject(deserializedData) && 's' in deserializedData,
      });
    }

    // Extract candles - handle both CandleFile format and single candle format
    const candles: FootprintCandle[] = [];

    // Check if this is a CandleFile with blocks
    if (
      isObject(deserializedData) &&
      'blocks' in deserializedData &&
      Array.isArray(deserializedData.blocks)
    ) {
      // CandleFile format
      for (const block of deserializedData.blocks) {
        for (const bc of block.candles) {
          candles.push(this.binaryToDomain(bc));
        }
      }
    } else if (isObject(deserializedData) && 's' in deserializedData) {
      // Single candle format - convert directly
      candles.push(
        this.flatBufferToDomain(
          deserializedData,
          fileInfo.symbol,
          fileInfo.exchange,
          fileInfo.timeframe
        )
      );
    } else {
      // The deserialized data might be a single candle in FlatBuffer format
      // Let's try to use it directly as candle data
      if (this.config.verbose) {
        console.log('Treating deserialized data as single candle');
      }
      candles.push(
        this.flatBufferToDomain(
          deserializedData,
          fileInfo.symbol,
          fileInfo.exchange,
          fileInfo.timeframe
        )
      );
    }

    // Save candles in batches to avoid memory issues
    const batchSize = this.config.batchSize;
    for (let i = 0; i < candles.length; i += batchSize) {
      const batch = candles.slice(i, i + batchSize);
      await this.config.targetStorage.saveMany(batch);
      this.progress.migratedCandles += batch.length;
    }

    const batchTime = Date.now() - batchStartTime;
    this.batchTimes.push(batchTime);

    if (this.config.verbose) {
      console.log(
        `Migrated ${candles.length} candles from ${fileInfo.filePath} in ${batchTime}ms`
      );
    }
  }

  /**
   * Convert FlatBuffer candle data to domain object
   */
  private flatBufferToDomain(
    candleData: any,
    symbol: string,
    exchange: string,
    timeframe: string
  ): FootprintCandle {
    if (this.config.verbose) {
      console.log('Converting candleData to FootprintCandle:', {
        t: candleData.t,
        ct: candleData.ct,
        o: candleData.o,
        keys: Object.keys(candleData),
      });
    }

    const candle = new FootprintCandle(
      symbol,
      new Timeframe(timeframe),
      candleData.tv || 0.01,
      exchange
    );

    // Set properties from FlatBuffer data
    candle.t = candleData.t || 0;
    candle.ct = candleData.ct || 0;
    candle.o = candleData.o || 0;
    candle.h = candleData.h || 0;
    candle.l = candleData.l || 0;
    candle.c = candleData.c || 0;
    candle.v = candleData.v || 0;
    candle.bv = candleData.bv || 0;
    candle.sv = candleData.sv || 0;
    candle.q = candleData.q || 0;
    candle.bq = candleData.bq || 0;
    candle.sq = candleData.sq || 0;
    candle.n = candleData.n || 0;
    candle.d = candleData.d || 0;
    candle.dMax = candleData.dMax || 0;
    candle.dMin = candleData.dMin || 0;
    candle.f = candleData.f || 0;
    candle.ls = candleData.ls || 0;
    candle.x = candleData.x || false;
    candle.aggs = candleData.aggs
      ? candleData.aggs.map((agg: any) => ({
          tp: agg.tp,
          bv: agg.bv,
          sv: agg.sv,
          v: agg.v,
          bq: agg.bq,
          sq: agg.sq,
          q: agg.q,
        }))
      : [];

    if (this.config.verbose) {
      console.log('Created FootprintCandle:', {
        t: candle.t,
        ct: candle.ct,
        o: candle.o,
        s: candle.s,
        ex: candle.ex,
        i: candle.i,
      });
    }

    return candle;
  }

  /**
   * Convert binary candle to domain object
   * Handles both BinaryCandle format (symbol, exchange, timeframe) and
   * FootprintCandleData format (s, ex, i)
   */
  private binaryToDomain(bc: BinaryCandle | any): FootprintCandle {
    // Handle both formats - prefer FootprintCandleData format (s, ex, i) over BinaryCandle format
    const symbol = bc.s ?? bc.symbol;
    const exchange = bc.ex ?? bc.exchange;
    const timeframe = bc.i ?? bc.timeframe;
    const tickValue = bc.tv ?? bc.tickValue ?? 0.01;

    if (!timeframe) {
      throw new Error(
        `Invalid timeframe: ${timeframe}. Valid timeframes: 1s, 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 8h, 12h, 1d`
      );
    }

    const candle = new FootprintCandle(
      symbol,
      new Timeframe(timeframe),
      tickValue,
      exchange
    );

    candle.t = bc.t ?? bc.openTime;
    candle.ct = bc.ct ?? bc.closeTime;
    candle.o = bc.o ?? bc.open;
    candle.h = bc.h ?? bc.high;
    candle.l = bc.l ?? bc.low;
    candle.c = bc.c ?? bc.close;
    candle.v = bc.v ?? bc.volume;
    candle.bv = bc.bv ?? bc.buyVolume;
    candle.sv = bc.sv ?? bc.sellVolume;
    candle.q = bc.q ?? bc.quoteVolume;
    candle.bq = bc.bq ?? bc.buyQuoteVolume;
    candle.sq = bc.sq ?? bc.sellQuoteVolume;
    candle.n = bc.n ?? bc.tradeCount;
    candle.d = bc.d ?? bc.delta;
    candle.dMax = bc.dMax ?? bc.deltaMax;
    candle.dMin = bc.dMin ?? bc.deltaMin;
    candle.f = bc.f ?? bc.firstTradeId;
    candle.ls = bc.ls ?? bc.lastTradeId;
    candle.x = bc.x ?? bc.isComplete;
    candle.aggs = (bc.aggs ?? []).map((agg: any) => this.binaryToAggs(agg));

    return candle;
  }

  /**
   * Convert binary aggregation to domain object
   */
  private binaryToAggs(bin: BinaryPriceBin | BinaryAggs): Aggs {
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

  /**
   * Validate migration results
   */
  private async validateMigration(
    migratedFiles: CandleFileInfo[]
  ): Promise<ValidationSummary> {
    console.log('Validating migration results...');

    let totalCandles = 0;
    let errorCount = 0;
    let warningCount = 0;
    const sampleErrors: string[] = [];

    for (const fileInfo of migratedFiles.slice(0, 10)) {
      // Sample validation
      try {
        // Read original file
        const buffer = fs.readFileSync(fileInfo.filePath);
        const candleFile = BinarySerializer.deserialize<CandleFile>(
          buffer,
          'candle'
        );

        const originalCandles = candleFile.blocks.reduce(
          (sum, block) => sum + block.candles.length,
          0
        );
        totalCandles += originalCandles;

        // Query migrated data
        const migratedCandles = await this.config.targetStorage.findBySymbol(
          fileInfo.symbol,
          fileInfo.exchange,
          fileInfo.timeframe
        );

        if (migratedCandles.length !== originalCandles) {
          errorCount++;
          sampleErrors.push(
            `${fileInfo.filePath}: Count mismatch - original: ${originalCandles}, migrated: ${migratedCandles.length}`
          );
        }
      } catch (error) {
        errorCount++;
        sampleErrors.push(`${fileInfo.filePath}: Validation error - ${error}`);
      }
    }

    const successRate =
      totalCandles > 0 ? (totalCandles - errorCount) / totalCandles : 0;

    return {
      totalCandles,
      errorCount,
      warningCount,
      successRate,
      sampleErrors: sampleErrors.slice(0, 5), // Limit sample errors
    };
  }

  /**
   * Check memory usage and trigger cleanup if needed
   */
  private async checkMemoryUsage(): Promise<void> {
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    this.progress.memoryUsageMB = memUsageMB;

    if (memUsageMB > this.config.maxMemoryMB) {
      if (this.config.verbose) {
        console.log(`Memory usage: ${memUsageMB.toFixed(2)}MB - triggering GC`);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
  }

  /**
   * Save migration checkpoint
   */
  private async saveCheckpoint(completedFiles: string[]): Promise<void> {
    if (!this.config.checkpointFile) {
      return;
    }

    const checkpoint: MigrationCheckpoint = {
      timestamp: Date.now(),
      completedFiles,
      progress: { ...this.progress },
      config: { ...this.config },
    };

    try {
      fs.writeFileSync(
        this.config.checkpointFile,
        JSON.stringify(checkpoint, null, 2)
      );
      if (this.config.verbose) {
        console.log(
          `Checkpoint saved: ${completedFiles.length} files completed`
        );
      }
    } catch (error) {
      console.warn('Failed to save checkpoint:', error);
    }
  }

  /**
   * Load migration checkpoint
   */
  private async loadCheckpoint(): Promise<void> {
    if (
      !this.config.checkpointFile ||
      !fs.existsSync(this.config.checkpointFile)
    ) {
      return;
    }

    try {
      const checkpointData = fs.readFileSync(
        this.config.checkpointFile,
        'utf8'
      );
      this.checkpoint = JSON.parse(checkpointData);

      if (this.checkpoint) {
        this.progress = { ...this.checkpoint.progress };
        console.log(
          `Resuming from checkpoint: ${this.checkpoint.completedFiles.length} files already completed`
        );
      }
    } catch (error) {
      console.warn('Failed to load checkpoint:', error);
      this.checkpoint = null;
    }
  }

  /**
   * Clean up checkpoint file
   */
  private async cleanupCheckpoint(): Promise<void> {
    if (
      !this.config.checkpointFile ||
      !fs.existsSync(this.config.checkpointFile)
    ) {
      return;
    }

    try {
      fs.unlinkSync(this.config.checkpointFile);
      if (this.config.verbose) {
        console.log('Checkpoint file cleaned up');
      }
    } catch (error) {
      console.warn('Failed to cleanup checkpoint:', error);
    }
  }

  /**
   * Create initial progress object
   */
  private createInitialProgress(): MigrationProgress {
    return {
      totalFiles: 0,
      processedFiles: 0,
      totalCandles: 0,
      migratedCandles: 0,
      startTime: Date.now(),
      memoryUsageMB: 0,
      errors: [],
      warnings: [],
    };
  }

  /**
   * Normalize configuration with defaults
   */
  private normalizeConfig(config: MigrationConfig): Required<MigrationConfig> {
    return {
      sourceDir: config.sourceDir,
      targetStorage: config.targetStorage,
      batchSize: config.batchSize ?? 1000,
      maxMemoryMB: config.maxMemoryMB ?? 512,
      verbose: config.verbose ?? false,
      dryRun: config.dryRun ?? false,
      resume: config.resume ?? false,
      checkpointFile:
        config.checkpointFile ??
        path.join(config.sourceDir, '.migration-checkpoint.json'),
    };
  }

  /**
   * Create dry run result
   */
  private createDryRunResult(candleFiles: CandleFileInfo[]): MigrationResult {
    const totalCandles = candleFiles.reduce(
      (sum, file) => sum + file.candleCount,
      0
    );

    return {
      success: true,
      progress: {
        ...this.progress,
        totalFiles: candleFiles.length,
        totalCandles,
      },
      duration: 0,
      migratedFiles: candleFiles,
      failedFiles: [],
      validationResults: {
        totalCandles,
        errorCount: 0,
        warningCount: 0,
        successRate: 1.0,
        sampleErrors: [],
      },
      performance: {
        candlesPerSecond: 0,
        mbPerSecond: 0,
        averageBatchTime: 0,
      },
    };
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(
    duration: number
  ): MigrationResult['performance'] {
    const durationSeconds = duration / 1000;
    const candlesPerSecond =
      durationSeconds > 0 ? this.progress.migratedCandles / durationSeconds : 0;

    // Estimate MB processed (rough calculation)
    const estimatedMB = this.progress.migratedCandles * 0.001; // ~1KB per candle estimate
    const mbPerSecond = durationSeconds > 0 ? estimatedMB / durationSeconds : 0;

    const averageBatchTime =
      this.batchTimes.length > 0
        ? this.batchTimes.reduce((sum, time) => sum + time, 0) /
          this.batchTimes.length
        : 0;

    return {
      candlesPerSecond,
      mbPerSecond,
      averageBatchTime,
    };
  }
}
