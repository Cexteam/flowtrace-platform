/**
 * CandleCache
 * Shared caching logic for candle storage.
 * Provides in-memory caching with dirty tracking for efficient persistence.
 */

import type { FootprintCandle } from '@flowtrace/core';

export interface CandleCacheConfig {
  maxEntries?: number;
}

export interface CacheStats {
  entries: number;
  dirtyEntries: number;
  totalCandles: number;
}

export class CandleCache {
  private readonly cache: Map<string, FootprintCandle[]> = new Map();
  private readonly dirtyKeys: Set<string> = new Set();
  private readonly maxEntries: number;

  constructor(config?: CandleCacheConfig) {
    this.maxEntries = config?.maxEntries ?? 1000;
  }

  /**
   * Get candles from cache
   */
  get(key: string): FootprintCandle[] | undefined {
    return this.cache.get(key);
  }

  /**
   * Check if cache has a key
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Set candles in cache
   */
  set(key: string, candles: FootprintCandle[]): void {
    // Evict oldest entries if at capacity
    if (!this.cache.has(key) && this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }
    this.cache.set(key, candles);
  }

  /**
   * Mark a cache entry as dirty (needs to be persisted)
   */
  markDirty(key: string): void {
    this.dirtyKeys.add(key);
  }

  /**
   * Mark a cache entry as clean (has been persisted)
   */
  markClean(key: string): void {
    this.dirtyKeys.delete(key);
  }

  /**
   * Check if a cache entry is dirty
   */
  isDirty(key: string): boolean {
    return this.dirtyKeys.has(key);
  }

  /**
   * Get all dirty keys
   */
  getDirtyKeys(): string[] {
    return Array.from(this.dirtyKeys);
  }

  /**
   * Delete a cache entry
   */
  delete(key: string): boolean {
    this.dirtyKeys.delete(key);
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.dirtyKeys.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    let totalCandles = 0;
    for (const candles of this.cache.values()) {
      totalCandles += candles.length;
    }

    return {
      entries: this.cache.size,
      dirtyEntries: this.dirtyKeys.size,
      totalCandles,
    };
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Add or update a candle in the cache
   * Returns true if the candle was added, false if it was updated
   */
  upsertCandle(key: string, candle: FootprintCandle): boolean {
    const candles = this.cache.get(key) || [];

    // Check for existing candle with same open time
    const existingIndex = candles.findIndex((c) => c.t === candle.t);
    if (existingIndex >= 0) {
      candles[existingIndex] = candle;
      this.cache.set(key, candles);
      this.markDirty(key);
      return false;
    }

    candles.push(candle);
    this.cache.set(key, candles);
    this.markDirty(key);
    return true;
  }

  /**
   * Add or update multiple candles in the cache
   */
  upsertCandles(key: string, newCandles: FootprintCandle[]): void {
    const existingCandles = this.cache.get(key) || [];

    for (const candle of newCandles) {
      const existingIndex = existingCandles.findIndex((c) => c.t === candle.t);
      if (existingIndex >= 0) {
        existingCandles[existingIndex] = candle;
      } else {
        existingCandles.push(candle);
      }
    }

    this.cache.set(key, existingCandles);
    this.markDirty(key);
  }

  /**
   * Find the latest candle in a cache entry
   */
  findLatest(key: string): FootprintCandle | null {
    const candles = this.cache.get(key);
    if (!candles || candles.length === 0) {
      return null;
    }

    return candles.reduce((latest, current) =>
      current.t > latest.t ? current : latest
    );
  }

  /**
   * Filter candles by time range
   */
  filterByTimeRange(
    key: string,
    startTime?: number,
    endTime?: number
  ): FootprintCandle[] {
    let candles = this.cache.get(key) || [];

    if (startTime !== undefined) {
      candles = candles.filter((c) => c.t >= startTime);
    }

    if (endTime !== undefined) {
      candles = candles.filter((c) => c.t <= endTime);
    }

    return candles;
  }

  /**
   * Evict the oldest cache entry
   */
  private evictOldest(): void {
    // Get the first key (oldest entry in insertion order)
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      // Don't evict dirty entries
      if (!this.dirtyKeys.has(firstKey)) {
        this.cache.delete(firstKey);
      }
    }
  }
}
