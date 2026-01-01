/**
 * LocalStorageAdapter - Filesystem-based tick storage
 *
 * Implements ITickStorage interface for local filesystem storage.
 * Uses binary files with serialization and time-based indexing.
 *
 * Directory structure:
 * {basePath}/
 *   {symbol}/
 *     data.bin     - Binary tick data
 *     index.tidx   - Time index file
 *
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { ITickStorage, Tick, TimeIndex } from '../types.js';

export interface LocalStorageConfig {
  /**
   * Base path for storage files
   */
  basePath: string;

  /**
   * Index interval in milliseconds
   * @default 60000 (1 minute)
   */
  indexInterval?: number;
}

/**
 * Simple time index implementation
 */
class SimpleTimeIndex {
  symbol: string;
  startTime: number = 0;
  endTime: number = 0;
  tickCount: number = 0;
  fileOffsets: Array<{ timestamp: number; offset: number }> = [];

  constructor(symbol: string) {
    this.symbol = symbol;
  }

  addEntry(timestamp: number, offset: number): void {
    if (this.tickCount === 0 || timestamp < this.startTime) {
      this.startTime = timestamp;
    }
    if (timestamp > this.endTime) {
      this.endTime = timestamp;
    }
    this.tickCount++;
    this.fileOffsets.push({ timestamp, offset });
  }

  toInterface(): TimeIndex {
    return {
      symbol: this.symbol,
      startTime: this.startTime,
      endTime: this.endTime,
      tickCount: this.tickCount,
      fileOffsets: this.fileOffsets,
    };
  }

  serialize(): Buffer {
    const data = JSON.stringify(this.toInterface());
    return Buffer.from(data, 'utf8');
  }

  static deserialize(buffer: Buffer): SimpleTimeIndex {
    const data = JSON.parse(buffer.toString('utf8')) as TimeIndex;
    const index = new SimpleTimeIndex(data.symbol);
    index.startTime = data.startTime;
    index.endTime = data.endTime;
    index.tickCount = data.tickCount;
    index.fileOffsets = data.fileOffsets;
    return index;
  }
}

/**
 * LocalStorageAdapter - Implements ITickStorage for local filesystem
 */
export class LocalStorageAdapter implements ITickStorage {
  private readonly basePath: string;
  private readonly indexInterval: number;
  private readonly indexes: Map<string, SimpleTimeIndex>;
  private closed: boolean;

  constructor(config: LocalStorageConfig) {
    this.basePath = config.basePath;
    this.indexInterval = config.indexInterval ?? 60000;
    this.indexes = new Map();
    this.closed = false;
  }

  /**
   * Get the directory path for a symbol
   */
  private getSymbolDir(symbol: string): string {
    // Sanitize symbol name for filesystem
    const safeSymbol = symbol.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.basePath, safeSymbol);
  }

  /**
   * Get the data file path for a symbol
   */
  private getDataPath(symbol: string): string {
    return path.join(this.getSymbolDir(symbol), 'data.bin');
  }

  /**
   * Get the index file path for a symbol
   */
  private getIndexPath(symbol: string): string {
    return path.join(this.getSymbolDir(symbol), 'index.tidx');
  }

  /**
   * Ensure the symbol directory exists
   */
  private async ensureSymbolDir(symbol: string): Promise<void> {
    const dir = this.getSymbolDir(symbol);
    await fs.mkdir(dir, { recursive: true });
  }

  /**
   * Load or create the index for a symbol
   */
  private async loadIndex(symbol: string): Promise<SimpleTimeIndex> {
    // Check cache first
    let index = this.indexes.get(symbol);
    if (index) {
      return index;
    }

    // Try to load from file
    const indexPath = this.getIndexPath(symbol);
    try {
      const buffer = await fs.readFile(indexPath);
      index = SimpleTimeIndex.deserialize(buffer);
      this.indexes.set(symbol, index);
      return index;
    } catch (error: unknown) {
      // File doesn't exist, create new index
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        index = new SimpleTimeIndex(symbol);
        this.indexes.set(symbol, index);
        return index;
      }
      throw error;
    }
  }

  /**
   * Save the index for a symbol
   */
  private async saveIndex(symbol: string): Promise<void> {
    const index = this.indexes.get(symbol);
    if (!index) {
      return;
    }

    const indexPath = this.getIndexPath(symbol);
    const buffer = index.serialize();
    await fs.writeFile(indexPath, buffer);
  }

  /**
   * Serialize ticks to binary format
   */
  private serializeTicks(ticks: Tick[]): Buffer {
    // Simple binary format: [count:4][tick1][tick2]...
    // Each tick: [timestamp:8][price:8][quantity:8]
    const buffer = Buffer.alloc(4 + ticks.length * 24);
    buffer.writeUInt32LE(ticks.length, 0);

    for (let i = 0; i < ticks.length; i++) {
      const tick = ticks[i]!;
      const offset = 4 + i * 24;
      buffer.writeDoubleLE(tick.timestamp, offset);
      buffer.writeDoubleLE(tick.price, offset + 8);
      buffer.writeDoubleLE(tick.quantity, offset + 16);
    }

    return buffer;
  }

  /**
   * Deserialize ticks from binary format
   */
  private deserializeTicks(buffer: Buffer): Tick[] {
    if (buffer.length < 4) {
      return [];
    }

    const count = buffer.readUInt32LE(0);
    const ticks: Tick[] = [];

    for (let i = 0; i < count; i++) {
      const offset = 4 + i * 24;
      if (offset + 24 > buffer.length) break;

      ticks.push({
        timestamp: buffer.readDoubleLE(offset),
        price: buffer.readDoubleLE(offset + 8),
        quantity: buffer.readDoubleLE(offset + 16),
      });
    }

    return ticks;
  }

  /**
   * Append ticks to storage for a symbol
   */
  async appendTicks(symbol: string, ticks: Tick[]): Promise<void> {
    if (this.closed) {
      throw new Error('Storage is closed');
    }

    if (ticks.length === 0) {
      return;
    }

    await this.ensureSymbolDir(symbol);

    const dataPath = this.getDataPath(symbol);
    const index = await this.loadIndex(symbol);

    // Get current file size for offset tracking
    let currentOffset = 0;
    try {
      const stats = await fs.stat(dataPath);
      currentOffset = stats.size;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    // Serialize ticks
    const buffer = this.serializeTicks(ticks);

    // Update index with new entries
    for (let i = 0; i < ticks.length; i++) {
      const tick = ticks[i];
      if (tick) {
        const tickOffset = currentOffset + 4 + i * 24;
        index.addEntry(tick.timestamp, tickOffset);
      }
    }

    // Append to data file
    await fs.appendFile(dataPath, buffer);

    // Save updated index
    await this.saveIndex(symbol);
  }

  /**
   * Read ticks within a time range
   */
  async readTicks(
    symbol: string,
    startTime: number,
    endTime: number
  ): Promise<Tick[]> {
    if (this.closed) {
      throw new Error('Storage is closed');
    }

    const dataPath = this.getDataPath(symbol);

    // Check if data file exists
    try {
      await fs.access(dataPath);
    } catch {
      return [];
    }

    // Read all data (for simplicity - could be optimized with index)
    const buffer = await fs.readFile(dataPath);

    if (buffer.length === 0) {
      return [];
    }

    // Deserialize and filter by time range
    const ticks = this.deserializeTicks(buffer);

    return ticks
      .filter(
        (tick) => tick.timestamp >= startTime && tick.timestamp <= endTime
      )
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get the time index for a symbol
   */
  async getTimeIndex(symbol: string): Promise<TimeIndex | null> {
    if (this.closed) {
      throw new Error('Storage is closed');
    }

    try {
      const index = await this.loadIndex(symbol);
      if (index.tickCount === 0) {
        return null;
      }
      return index.toInterface();
    } catch {
      return null;
    }
  }

  /**
   * Check if data exists for a symbol
   */
  async hasData(symbol: string): Promise<boolean> {
    if (this.closed) {
      throw new Error('Storage is closed');
    }

    const dataPath = this.getDataPath(symbol);
    try {
      const stats = await fs.stat(dataPath);
      return stats.size > 0;
    } catch {
      return false;
    }
  }

  /**
   * Delete all data for a symbol
   */
  async deleteSymbol(symbol: string): Promise<void> {
    if (this.closed) {
      throw new Error('Storage is closed');
    }

    const symbolDir = this.getSymbolDir(symbol);

    try {
      await fs.rm(symbolDir, { recursive: true, force: true });
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    // Remove from cache
    this.indexes.delete(symbol);
  }

  /**
   * Close the storage
   */
  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    // Save all indexes
    for (const symbol of this.indexes.keys()) {
      await this.saveIndex(symbol);
    }

    this.indexes.clear();
    this.closed = true;
  }
}
