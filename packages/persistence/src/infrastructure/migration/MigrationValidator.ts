/**
 * Migration Validator
 * Validates data integrity during and after migration from file-based to database storage.
 * Provides comprehensive validation of candle data, footprint aggregations, and metadata.
 */

import * as fs from 'fs';
import * as path from 'path';
import { injectable } from 'inversify';
import type { FootprintCandle } from '@flowtrace/core';
import type { CandleStoragePort } from '../../features/candlePersistence/application/ports/out/CandleStoragePort.js';
import { BinarySerializer } from '../storage/serialization/binary/BinarySerializer.js';
import type {
  CandleFile,
  BinaryCandle,
  BinaryAggs,
  BinaryPriceBin,
} from '../storage/serialization/binary/schemas/types.js';
import type { Aggs } from '@flowtrace/core';

export interface ValidationConfig {
  /** Source directory containing .ftcd files */
  sourceDir: string;

  /** Target storage adapter to validate against */
  targetStorage: CandleStoragePort;

  /** Sample size for validation (0 = validate all) */
  sampleSize?: number;

  /** Enable detailed field-by-field comparison */
  detailedComparison?: boolean;

  /** Tolerance for floating-point comparisons */
  floatTolerance?: number;

  /** Enable verbose logging */
  verbose?: boolean;

  /** Output directory for validation reports */
  reportDir?: string;
}

export interface ValidationResult {
  /** File path being validated */
  filePath: string;

  /** Exchange name */
  exchange: string;

  /** Symbol name */
  symbol: string;

  /** Timeframe */
  timeframe: string;

  /** Validation success status */
  success: boolean;

  /** Total candles validated */
  totalCandles: number;

  /** Candles with errors */
  errorCount: number;

  /** Candles with warnings */
  warningCount: number;

  /** Validation errors */
  errors: ValidationError[];

  /** Validation warnings */
  warnings: ValidationWarning[];

  /** Performance metrics */
  metrics: {
    validationTimeMs: number;
    candlesPerSecond: number;
  };
}

export interface ValidationError {
  /** Candle identifier */
  candleId: string;

  /** Error type */
  type:
    | 'MISSING'
    | 'FIELD_MISMATCH'
    | 'AGGREGATION_ERROR'
    | 'SERIALIZATION_ERROR';

  /** Error message */
  message: string;

  /** Expected value (if applicable) */
  expected?: any;

  /** Actual value (if applicable) */
  actual?: any;

  /** Field name (if applicable) */
  field?: string;
}

export interface ValidationWarning {
  /** Candle identifier */
  candleId: string;

  /** Warning type */
  type: 'PRECISION_LOSS' | 'TIMESTAMP_DRIFT' | 'MINOR_DIFFERENCE';

  /** Warning message */
  message: string;

  /** Additional context */
  context?: any;
}

export interface ValidationSummary {
  /** Total files validated */
  totalFiles: number;

  /** Files with validation errors */
  filesWithErrors: number;

  /** Files with warnings only */
  filesWithWarnings: number;

  /** Total candles validated */
  totalCandles: number;

  /** Total errors found */
  totalErrors: number;

  /** Total warnings found */
  totalWarnings: number;

  /** Overall success rate */
  successRate: number;

  /** Validation duration */
  durationMs: number;

  /** Most common error types */
  commonErrors: Array<{ type: string; count: number }>;

  /** Performance metrics */
  performance: {
    candlesPerSecond: number;
    filesPerSecond: number;
  };
}

export interface ValidationReport {
  /** Report generation timestamp */
  timestamp: number;

  /** Validation configuration used */
  config: ValidationConfig;

  /** Overall summary */
  summary: ValidationSummary;

  /** Individual file results */
  fileResults: ValidationResult[];

  /** Sample errors for analysis */
  sampleErrors: ValidationError[];

  /** Recommendations for fixing issues */
  recommendations: string[];
}

/**
 * Migration Validator
 * Provides comprehensive validation of migrated candle data to ensure integrity
 * and completeness of the migration process.
 */
@injectable()
export class MigrationValidator {
  private config!: Required<ValidationConfig>;

  /**
   * Validate migration results
   */
  async validateMigration(config: ValidationConfig): Promise<ValidationReport> {
    this.config = this.normalizeConfig(config);
    const startTime = Date.now();

    console.log('Starting migration validation...');
    console.log(`Source: ${this.config.sourceDir}`);
    console.log(`Sample size: ${this.config.sampleSize || 'all'}`);

    try {
      // Scan source files
      const sourceFiles = await this.scanSourceFiles();
      console.log(`Found ${sourceFiles.length} source files`);

      // Select files for validation
      const filesToValidate = this.selectValidationSample(sourceFiles);
      console.log(`Validating ${filesToValidate.length} files`);

      // Validate each file
      const fileResults: ValidationResult[] = [];
      for (const filePath of filesToValidate) {
        const result = await this.validateFile(filePath);
        fileResults.push(result);

        if (this.config.verbose) {
          console.log(
            `Validated ${path.basename(filePath)}: ${
              result.success ? 'PASS' : 'FAIL'
            }`
          );
        }
      }

      // Generate summary
      const summary = this.generateSummary(fileResults, Date.now() - startTime);

      // Generate recommendations
      const recommendations = this.generateRecommendations(fileResults);

      const report: ValidationReport = {
        timestamp: Date.now(),
        config: this.config,
        summary,
        fileResults,
        sampleErrors: this.extractSampleErrors(fileResults),
        recommendations,
      };

      // Save report if output directory specified
      if (this.config.reportDir) {
        await this.saveReport(report);
      }

      console.log('Validation completed');
      console.log(`Success rate: ${(summary.successRate * 100).toFixed(2)}%`);
      console.log(`Total errors: ${summary.totalErrors}`);
      console.log(`Total warnings: ${summary.totalWarnings}`);

      return report;
    } catch (error) {
      console.error('Validation failed:', error);
      throw error;
    }
  }

  /**
   * Validate a single file
   */
  private async validateFile(filePath: string): Promise<ValidationResult> {
    const startTime = Date.now();
    const fileName = path.basename(filePath, '.ftcd');
    const parts = fileName.split('_');

    if (parts.length < 3) {
      throw new Error(`Invalid filename format: ${fileName}`);
    }

    const exchange = parts[0]!;
    const symbol = parts.slice(1, -1).join('_');
    const timeframe = parts[parts.length - 1]!;

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Read original file
      const buffer = fs.readFileSync(filePath);
      const candleFile = BinarySerializer.deserialize<CandleFile>(
        buffer,
        'candle'
      );

      // Extract all candles from blocks
      const originalCandles: BinaryCandle[] = [];
      for (const block of candleFile.blocks) {
        originalCandles.push(...block.candles);
      }

      // Query migrated data
      const migratedCandles = await this.config.targetStorage.findBySymbol(
        symbol,
        exchange,
        timeframe
      );

      // Validate count
      if (originalCandles.length !== migratedCandles.length) {
        errors.push({
          candleId: `${exchange}:${symbol}:${timeframe}`,
          type: 'MISSING',
          message: `Candle count mismatch: expected ${originalCandles.length}, got ${migratedCandles.length}`,
          expected: originalCandles.length,
          actual: migratedCandles.length,
        });
      }

      // Create lookup map for migrated candles
      const migratedMap = new Map<number, FootprintCandle>();
      for (const candle of migratedCandles) {
        migratedMap.set(candle.t, candle);
      }

      // Validate each candle
      for (const originalCandle of originalCandles) {
        const candleId = `${exchange}:${symbol}:${timeframe}:${originalCandle.openTime}`;
        const migratedCandle = migratedMap.get(originalCandle.openTime);

        if (!migratedCandle) {
          errors.push({
            candleId,
            type: 'MISSING',
            message: 'Candle not found in migrated data',
          });
          continue;
        }

        // Validate candle fields
        this.validateCandleFields(
          originalCandle,
          migratedCandle,
          candleId,
          errors,
          warnings
        );

        // Validate aggregations
        this.validateAggregations(
          originalCandle,
          migratedCandle,
          candleId,
          errors,
          warnings
        );
      }

      const duration = Date.now() - startTime;
      const candlesPerSecond =
        duration > 0 ? (originalCandles.length / duration) * 1000 : 0;

      return {
        filePath,
        exchange,
        symbol,
        timeframe,
        success: errors.length === 0,
        totalCandles: originalCandles.length,
        errorCount: errors.length,
        warningCount: warnings.length,
        errors,
        warnings,
        metrics: {
          validationTimeMs: duration,
          candlesPerSecond,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        filePath,
        exchange,
        symbol,
        timeframe,
        success: false,
        totalCandles: 0,
        errorCount: 1,
        warningCount: 0,
        errors: [
          {
            candleId: `${exchange}:${symbol}:${timeframe}`,
            type: 'SERIALIZATION_ERROR',
            message: `Validation failed: ${error}`,
          },
        ],
        warnings: [],
        metrics: {
          validationTimeMs: duration,
          candlesPerSecond: 0,
        },
      };
    }
  }

  /**
   * Validate candle fields
   */
  private validateCandleFields(
    original: BinaryCandle,
    migrated: FootprintCandle,
    candleId: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Basic fields
    this.validateField(original.symbol, migrated.s, 'symbol', candleId, errors);
    this.validateField(
      original.exchange,
      migrated.ex,
      'exchange',
      candleId,
      errors
    );
    this.validateField(
      original.timeframe,
      migrated.i,
      'timeframe',
      candleId,
      errors
    );
    this.validateField(
      original.openTime,
      migrated.t,
      'openTime',
      candleId,
      errors
    );
    this.validateField(
      original.closeTime,
      migrated.ct,
      'closeTime',
      candleId,
      errors
    );

    // OHLCV fields (with tolerance for floating-point precision)
    this.validateFloatField(
      original.open,
      migrated.o,
      'open',
      candleId,
      errors,
      warnings
    );
    this.validateFloatField(
      original.high,
      migrated.h,
      'high',
      candleId,
      errors,
      warnings
    );
    this.validateFloatField(
      original.low,
      migrated.l,
      'low',
      candleId,
      errors,
      warnings
    );
    this.validateFloatField(
      original.close,
      migrated.c,
      'close',
      candleId,
      errors,
      warnings
    );
    this.validateFloatField(
      original.volume,
      migrated.v,
      'volume',
      candleId,
      errors,
      warnings
    );

    // Volume fields
    this.validateFloatField(
      original.buyVolume,
      migrated.bv,
      'buyVolume',
      candleId,
      errors,
      warnings
    );
    this.validateFloatField(
      original.sellVolume,
      migrated.sv,
      'sellVolume',
      candleId,
      errors,
      warnings
    );
    this.validateFloatField(
      original.quoteVolume,
      migrated.q,
      'quoteVolume',
      candleId,
      errors,
      warnings
    );
    this.validateFloatField(
      original.buyQuoteVolume,
      migrated.bq,
      'buyQuoteVolume',
      candleId,
      errors,
      warnings
    );
    this.validateFloatField(
      original.sellQuoteVolume,
      migrated.sq,
      'sellQuoteVolume',
      candleId,
      errors,
      warnings
    );

    // Delta and statistics
    this.validateFloatField(
      original.delta,
      migrated.d,
      'delta',
      candleId,
      errors,
      warnings
    );
    this.validateFloatField(
      original.deltaMax,
      migrated.dMax,
      'deltaMax',
      candleId,
      errors,
      warnings
    );
    this.validateFloatField(
      original.deltaMin,
      migrated.dMin,
      'deltaMin',
      candleId,
      errors,
      warnings
    );
    this.validateField(
      original.tradeCount,
      migrated.n,
      'tradeCount',
      candleId,
      errors
    );

    // Trade IDs
    this.validateFloatField(
      original.firstTradeId,
      migrated.f,
      'firstTradeId',
      candleId,
      errors,
      warnings
    );
    this.validateFloatField(
      original.lastTradeId,
      migrated.ls,
      'lastTradeId',
      candleId,
      errors,
      warnings
    );

    // Completion flag
    this.validateField(
      original.isComplete,
      migrated.x,
      'isComplete',
      candleId,
      errors
    );
  }

  /**
   * Validate aggregations
   */
  private validateAggregations(
    original: BinaryCandle,
    migrated: FootprintCandle,
    candleId: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (original.aggs.length !== migrated.aggs.length) {
      errors.push({
        candleId,
        type: 'AGGREGATION_ERROR',
        message: `Aggregation count mismatch: expected ${original.aggs.length}, got ${migrated.aggs.length}`,
        field: 'aggs',
        expected: original.aggs.length,
        actual: migrated.aggs.length,
      });
      return;
    }

    // Sort both arrays by price for comparison
    const originalSorted = [...original.aggs].sort(
      (a, b) => this.getPrice(a) - this.getPrice(b)
    );
    const migratedSorted = [...migrated.aggs].sort((a, b) => a.tp - b.tp);

    for (let i = 0; i < originalSorted.length; i++) {
      const originalAgg = originalSorted[i]!;
      const migratedAgg = migratedSorted[i]!;
      const aggId = `${candleId}:agg:${i}`;

      // Convert original to comparable format
      const originalPrice = this.getPrice(originalAgg);
      const originalBuyVol = this.getBuyVolume(originalAgg);
      const originalSellVol = this.getSellVolume(originalAgg);

      this.validateFloatField(
        originalPrice,
        migratedAgg.tp,
        'price',
        aggId,
        errors,
        warnings
      );
      this.validateFloatField(
        originalBuyVol,
        migratedAgg.bv,
        'buyVolume',
        aggId,
        errors,
        warnings
      );
      this.validateFloatField(
        originalSellVol,
        migratedAgg.sv,
        'sellVolume',
        aggId,
        errors,
        warnings
      );
    }
  }

  /**
   * Validate a field value
   */
  private validateField(
    expected: any,
    actual: any,
    fieldName: string,
    candleId: string,
    errors: ValidationError[]
  ): void {
    if (expected !== actual) {
      errors.push({
        candleId,
        type: 'FIELD_MISMATCH',
        message: `Field '${fieldName}' mismatch`,
        field: fieldName,
        expected,
        actual,
      });
    }
  }

  /**
   * Validate a floating-point field with tolerance
   */
  private validateFloatField(
    expected: number,
    actual: number,
    fieldName: string,
    candleId: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const diff = Math.abs(expected - actual);
    const tolerance = this.config.floatTolerance;

    if (diff > tolerance) {
      if (diff > tolerance * 10) {
        errors.push({
          candleId,
          type: 'FIELD_MISMATCH',
          message: `Field '${fieldName}' significant difference: ${diff}`,
          field: fieldName,
          expected,
          actual,
        });
      } else {
        warnings.push({
          candleId,
          type: 'PRECISION_LOSS',
          message: `Field '${fieldName}' minor precision difference: ${diff}`,
          context: { expected, actual, diff },
        });
      }
    }
  }

  /**
   * Get price from binary aggregation
   */
  private getPrice(agg: BinaryPriceBin | BinaryAggs): number {
    return 'tp' in agg ? agg.tp : agg.price;
  }

  /**
   * Get buy volume from binary aggregation
   */
  private getBuyVolume(agg: BinaryPriceBin | BinaryAggs): number {
    return 'bv' in agg ? agg.bv : agg.buyVolume;
  }

  /**
   * Get sell volume from binary aggregation
   */
  private getSellVolume(agg: BinaryPriceBin | BinaryAggs): number {
    return 'sv' in agg ? agg.sv : agg.sellVolume;
  }

  /**
   * Scan source directory for .ftcd files
   */
  private async scanSourceFiles(): Promise<string[]> {
    const candlesDir = path.join(this.config.sourceDir, 'candles');

    if (!fs.existsSync(candlesDir)) {
      throw new Error(`Candles directory not found: ${candlesDir}`);
    }

    const files = fs.readdirSync(candlesDir);
    return files
      .filter((file) => file.endsWith('.ftcd'))
      .map((file) => path.join(candlesDir, file))
      .sort();
  }

  /**
   * Select files for validation sampling
   */
  private selectValidationSample(files: string[]): string[] {
    if (
      this.config.sampleSize === 0 ||
      this.config.sampleSize >= files.length
    ) {
      return files;
    }

    // Select evenly distributed sample
    const step = Math.floor(files.length / this.config.sampleSize);
    const sample: string[] = [];

    for (let i = 0; i < files.length; i += step) {
      sample.push(files[i]!);
      if (sample.length >= this.config.sampleSize) {
        break;
      }
    }

    return sample;
  }

  /**
   * Generate validation summary
   */
  private generateSummary(
    results: ValidationResult[],
    durationMs: number
  ): ValidationSummary {
    const totalFiles = results.length;
    const filesWithErrors = results.filter((r) => r.errorCount > 0).length;
    const filesWithWarnings = results.filter(
      (r) => r.warningCount > 0 && r.errorCount === 0
    ).length;
    const totalCandles = results.reduce((sum, r) => sum + r.totalCandles, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warningCount, 0);
    const successRate =
      totalFiles > 0 ? (totalFiles - filesWithErrors) / totalFiles : 0;

    // Count common error types
    const errorTypeCounts = new Map<string, number>();
    for (const result of results) {
      for (const error of result.errors) {
        const count = errorTypeCounts.get(error.type) || 0;
        errorTypeCounts.set(error.type, count + 1);
      }
    }

    const commonErrors = Array.from(errorTypeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const candlesPerSecond =
      durationMs > 0 ? (totalCandles / durationMs) * 1000 : 0;
    const filesPerSecond =
      durationMs > 0 ? (totalFiles / durationMs) * 1000 : 0;

    return {
      totalFiles,
      filesWithErrors,
      filesWithWarnings,
      totalCandles,
      totalErrors,
      totalWarnings,
      successRate,
      durationMs,
      commonErrors,
      performance: {
        candlesPerSecond,
        filesPerSecond,
      },
    };
  }

  /**
   * Extract sample errors for analysis
   */
  private extractSampleErrors(results: ValidationResult[]): ValidationError[] {
    const allErrors: ValidationError[] = [];

    for (const result of results) {
      allErrors.push(...result.errors);
    }

    // Group by error type and take samples
    const errorsByType = new Map<string, ValidationError[]>();
    for (const error of allErrors) {
      const errors = errorsByType.get(error.type) || [];
      errors.push(error);
      errorsByType.set(error.type, errors);
    }

    const sampleErrors: ValidationError[] = [];
    for (const [type, errors] of errorsByType) {
      // Take up to 3 samples per error type
      sampleErrors.push(...errors.slice(0, 3));
    }

    return sampleErrors.slice(0, 20); // Limit total samples
  }

  /**
   * Generate recommendations based on validation results
   */
  private generateRecommendations(results: ValidationResult[]): string[] {
    const recommendations: string[] = [];
    const errorCounts = new Map<string, number>();

    // Count error types
    for (const result of results) {
      for (const error of result.errors) {
        const count = errorCounts.get(error.type) || 0;
        errorCounts.set(error.type, count + 1);
      }
    }

    // Generate recommendations based on common errors
    if (errorCounts.get('MISSING') || 0 > 0) {
      recommendations.push(
        'Missing candles detected. Check migration batch processing and ensure all files are processed.'
      );
    }

    if (errorCounts.get('FIELD_MISMATCH') || 0 > 0) {
      recommendations.push(
        'Field mismatches detected. Review data type conversions and serialization logic.'
      );
    }

    if (errorCounts.get('AGGREGATION_ERROR') || 0 > 0) {
      recommendations.push(
        'Aggregation errors detected. Verify footprint aggregation conversion logic.'
      );
    }

    if (errorCounts.get('SERIALIZATION_ERROR') || 0 > 0) {
      recommendations.push(
        'Serialization errors detected. Check FlatBuffer schema compatibility and file integrity.'
      );
    }

    // Performance recommendations
    const avgCandlesPerSecond =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.metrics.candlesPerSecond, 0) /
          results.length
        : 0;

    if (avgCandlesPerSecond < 1000) {
      recommendations.push(
        'Validation performance is slow. Consider increasing batch sizes or optimizing queries.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'Migration validation completed successfully with no issues detected.'
      );
    }

    return recommendations;
  }

  /**
   * Save validation report to file
   */
  private async saveReport(report: ValidationReport): Promise<void> {
    if (!fs.existsSync(this.config.reportDir)) {
      fs.mkdirSync(this.config.reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(
      this.config.reportDir,
      `migration-validation-${timestamp}.json`
    );

    try {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`Validation report saved: ${reportPath}`);
    } catch (error) {
      console.warn('Failed to save validation report:', error);
    }
  }

  /**
   * Normalize configuration with defaults
   */
  private normalizeConfig(
    config: ValidationConfig
  ): Required<ValidationConfig> {
    return {
      sourceDir: config.sourceDir,
      targetStorage: config.targetStorage,
      sampleSize: config.sampleSize ?? 0,
      detailedComparison: config.detailedComparison ?? true,
      floatTolerance: config.floatTolerance ?? 1e-10,
      verbose: config.verbose ?? false,
      reportDir:
        config.reportDir ?? path.join(config.sourceDir, 'validation-reports'),
    };
  }
}
