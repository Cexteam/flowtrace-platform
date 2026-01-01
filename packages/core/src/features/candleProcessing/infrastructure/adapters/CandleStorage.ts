/**
 * Unified CandleStorage Adapter
 *
 * Single implementation of CandleStoragePort for all contexts (main thread, worker thread).
 * Uses in-memory Map storage for fast access. Context is injected for logging purposes.
 *
 * Replaces MainThreadCandleStorage and WorkerCandleStorage to eliminate duplicate code.
 *
 */

import { injectable, inject } from 'inversify';
import { CandleStoragePort } from '../../application/ports/out/CandleStoragePort.js';
import { CandleGroup } from '../../domain/entities/CandleGroup.js';
import { SymbolConfig } from '../../domain/types/index.js';
import { createLogger } from '../../../../shared/lib/logger/logger.js';

/**
 * Internal storage entry with dirty tracking
 */
interface CandleStorageEntry {
  group: CandleGroup;
  dirty: boolean;
}

/**
 * Unified CandleStorage
 * Implements CandleStoragePort for all contexts with dirty tracking
 * Uses in-memory Map for fast access
 */
@injectable()
export class CandleStorage implements CandleStoragePort {
  private entries: Map<string, CandleStorageEntry> = new Map();
  private logger;
  private instanceId: string;

  constructor(@inject('CANDLE_STORAGE_CONTEXT') context: string) {
    this.logger = createLogger(`${context}CandleStorage`);
    this.instanceId = Math.random().toString(36).substring(7);
    this.logger.info('CandleStorage instance created', {
      instanceId: this.instanceId,
    });
  }

  /**
   * Get the candle group for a symbol
   */
  async getCandleGroup(symbol: string): Promise<CandleGroup | null> {
    const entry = this.entries.get(symbol);
    return entry?.group || null;
  }

  /**
   * Save a candle group for a symbol
   * Automatically marks the symbol as dirty
   */
  async saveCandleGroup(symbol: string, group: CandleGroup): Promise<void> {
    this.entries.set(symbol, { group, dirty: true });
  }

  /**
   * Initialize a candle group for a symbol
   * New candle groups are marked as dirty
   */
  async initializeCandleGroup(
    symbol: string,
    config: SymbolConfig
  ): Promise<CandleGroup> {
    const group = CandleGroup.createDefault(
      symbol,
      config.exchange,
      config.tickValue
    );

    this.entries.set(symbol, { group, dirty: true });

    this.logger.info('Initialized candle group (marked dirty)', {
      symbol,
      exchange: config.exchange,
      tickValue: config.tickValue,
      timeframes: group.size,
      instanceId: this.instanceId,
    });

    return group;
  }

  /**
   * Delete a candle group for a symbol
   */
  async deleteCandleGroup(symbol: string): Promise<void> {
    const deleted = this.entries.delete(symbol);

    if (deleted) {
      this.logger.info('Deleted candle group', { symbol });
    } else {
      this.logger.debug('No candle group to delete', { symbol });
    }
  }

  // ============ Dirty Tracking Methods ============

  /**
   * Mark a symbol as dirty (modified since last flush)
   */
  markDirty(symbol: string): void {
    const entry = this.entries.get(symbol);
    if (entry) {
      entry.dirty = true;
    }
  }

  /**
   * Mark a symbol as clean (successfully flushed)
   */
  markClean(symbol: string): void {
    const entry = this.entries.get(symbol);
    if (entry) {
      entry.dirty = false;
    }
  }

  /**
   * Check if a symbol is dirty
   */
  isDirty(symbol: string): boolean {
    const entry = this.entries.get(symbol);
    return entry?.dirty ?? false;
  }

  /**
   * Get all symbols that are marked as dirty
   */
  getAllDirtySymbols(): string[] {
    const dirtySymbols: string[] = [];
    for (const [symbol, entry] of this.entries) {
      if (entry.dirty) {
        dirtySymbols.push(symbol);
      }
    }
    return dirtySymbols;
  }

  /**
   * Get all dirty CandleGroups with their symbols
   */
  getAllDirtyGroups(): Array<{ symbol: string; group: CandleGroup }> {
    const dirtyGroups: Array<{ symbol: string; group: CandleGroup }> = [];
    for (const [symbol, entry] of this.entries) {
      if (entry.dirty) {
        dirtyGroups.push({ symbol, group: entry.group });
      }
    }
    return dirtyGroups;
  }

  /**
   * Restore a CandleGroup from persisted state
   * Sets dirty flag to false (not dirty when restored)
   */
  restoreFromState(symbol: string, group: CandleGroup): void {
    this.entries.set(symbol, { group, dirty: false });

    this.logger.info('Restored candle group from state (not dirty)', {
      symbol,
      timeframes: group.size,
      instanceId: this.instanceId,
    });
  }

  // ============ Utility Methods ============

  /**
   * Get all symbols with candle groups
   * Utility method for status reporting
   */
  getAllSymbols(): string[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Get total number of symbols
   * Utility method for status reporting
   */
  getSymbolCount(): number {
    return this.entries.size;
  }

  /**
   * Clear all candle groups
   * Utility method for shutdown/reset
   */
  clear(): void {
    const count = this.entries.size;
    this.entries.clear();
    this.logger.info('Cleared all candle groups', { count });
  }
}
