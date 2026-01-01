/**
 * PathResolver
 * Handles path generation logic for candle storage files.
 * Provides consistent path formatting across the application.
 */

import * as path from 'path';

export interface PathResolverConfig {
  baseDir: string;
  candlesSubdir?: string;
  extension?: string;
}

export class PathResolver {
  private readonly baseDir: string;
  private readonly candlesSubdir: string;
  private readonly extension: string;

  constructor(config: PathResolverConfig) {
    this.baseDir = config.baseDir;
    this.candlesSubdir = config.candlesSubdir ?? 'candles';
    this.extension = config.extension ?? '.ftcd';
  }

  /**
   * Get the candles directory path
   */
  getCandlesDirectory(): string {
    return path.join(this.baseDir, this.candlesSubdir);
  }

  /**
   * Get the file path for a specific symbol/exchange/timeframe combination
   */
  getFilePath(symbol: string, exchange: string, timeframe: string): string {
    const safeSymbol = this.sanitize(symbol);
    const safeExchange = this.sanitize(exchange);
    const safeTimeframe = this.sanitize(timeframe);

    return path.join(
      this.getCandlesDirectory(),
      `${safeExchange}_${safeSymbol}_${safeTimeframe}${this.extension}`
    );
  }

  /**
   * Get the file path for a specific exchange directory (for per-exchange organization)
   */
  getExchangeFilePath(
    symbol: string,
    exchange: string,
    timeframe: string
  ): string {
    const safeSymbol = this.sanitize(symbol);
    const safeExchange = this.sanitize(exchange);
    const safeTimeframe = this.sanitize(timeframe);

    return path.join(
      this.getCandlesDirectory(),
      safeExchange,
      `${safeSymbol}_${safeTimeframe}${this.extension}`
    );
  }

  /**
   * Generate a cache key for a symbol/exchange/timeframe combination
   */
  getCacheKey(symbol: string, exchange: string, timeframe: string): string {
    return `${exchange}:${symbol}:${timeframe}`;
  }

  /**
   * Parse a cache key back into its components
   */
  parseCacheKey(
    cacheKey: string
  ): { exchange: string; symbol: string; timeframe: string } | null {
    const parts = cacheKey.split(':');
    if (parts.length !== 3) {
      return null;
    }
    return {
      exchange: parts[0]!,
      symbol: parts[1]!,
      timeframe: parts[2]!,
    };
  }

  /**
   * Get the base directory
   */
  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * Get the file extension
   */
  getExtension(): string {
    return this.extension;
  }

  /**
   * Sanitize a string for use in file paths
   * Replaces non-alphanumeric characters with underscores
   */
  private sanitize(value: string): string {
    return value.replace(/[^a-zA-Z0-9]/g, '_');
  }
}
