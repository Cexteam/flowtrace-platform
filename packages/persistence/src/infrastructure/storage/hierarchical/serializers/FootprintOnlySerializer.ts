/**
 * FootprintOnlySerializer
 *
 * Serializes FootprintData (aggregations only) to binary format.
 * Variable-length records due to aggs array.
 *
 * Binary format:
 * Header (32 bytes):
 * - t: int64 (8 bytes) - Open timestamp
 * - ct: int64 (8 bytes) - Close timestamp
 * - n: int32 (4 bytes) - Number of trades
 * - tv: float64 (8 bytes) - Tick value
 * - aggsCount: int32 (4 bytes) - Number of aggs
 *
 * Each Agg (48 bytes):
 * - tp: float64 (8 bytes) - Tick price
 * - v: float64 (8 bytes) - Volume
 * - bv: float64 (8 bytes) - Buy volume
 * - sv: float64 (8 bytes) - Sell volume
 * - bq: float64 (8 bytes) - Buy quote
 * - sq: float64 (8 bytes) - Sell quote
 */

import type { FootprintData, FootprintAgg } from '../types.js';

/** Header size in bytes */
const HEADER_SIZE = 32;

/** Size of each agg record in bytes */
const AGG_SIZE = 48;

/**
 * FootprintOnlySerializer
 * Serializes/deserializes FootprintData to binary format
 */
export class FootprintOnlySerializer {
  /**
   * Calculate total buffer size for a footprint
   */
  calculateSize(data: FootprintData): number {
    return HEADER_SIZE + data.aggs.length * AGG_SIZE;
  }

  /**
   * Serialize FootprintData to Buffer
   */
  serialize(data: FootprintData): Buffer {
    const totalSize = this.calculateSize(data);
    const buffer = Buffer.alloc(totalSize);
    let offset = 0;

    // Header
    buffer.writeBigInt64LE(BigInt(data.t), offset);
    offset += 8;
    buffer.writeBigInt64LE(BigInt(data.ct), offset);
    offset += 8;
    buffer.writeInt32LE(data.n, offset);
    offset += 4;
    buffer.writeDoubleLE(data.tv, offset);
    offset += 8;
    buffer.writeInt32LE(data.aggs.length, offset);
    offset += 4;

    // Aggs
    for (const agg of data.aggs) {
      buffer.writeDoubleLE(agg.tp, offset);
      offset += 8;
      buffer.writeDoubleLE(agg.v, offset);
      offset += 8;
      buffer.writeDoubleLE(agg.bv, offset);
      offset += 8;
      buffer.writeDoubleLE(agg.sv, offset);
      offset += 8;
      buffer.writeDoubleLE(agg.bq, offset);
      offset += 8;
      buffer.writeDoubleLE(agg.sq, offset);
      offset += 8;
    }

    return buffer;
  }

  /**
   * Deserialize Buffer to FootprintData
   * Note: symbol and interval must be provided from context
   */
  deserialize(buffer: Buffer, symbol: string, interval: string): FootprintData {
    if (buffer.length < HEADER_SIZE) {
      throw new Error(
        `Buffer too small: expected at least ${HEADER_SIZE}, got ${buffer.length}`
      );
    }

    let offset = 0;

    // Header
    const t = Number(buffer.readBigInt64LE(offset));
    offset += 8;
    const ct = Number(buffer.readBigInt64LE(offset));
    offset += 8;
    const n = buffer.readInt32LE(offset);
    offset += 4;
    const tv = buffer.readDoubleLE(offset);
    offset += 8;
    const aggsCount = buffer.readInt32LE(offset);
    offset += 4;

    // Validate buffer size
    const expectedSize = HEADER_SIZE + aggsCount * AGG_SIZE;
    if (buffer.length < expectedSize) {
      throw new Error(
        `Buffer too small for ${aggsCount} aggs: expected ${expectedSize}, got ${buffer.length}`
      );
    }

    // Aggs
    const aggs: FootprintAgg[] = [];
    for (let i = 0; i < aggsCount; i++) {
      const tp = buffer.readDoubleLE(offset);
      offset += 8;
      const v = buffer.readDoubleLE(offset);
      offset += 8;
      const bv = buffer.readDoubleLE(offset);
      offset += 8;
      const sv = buffer.readDoubleLE(offset);
      offset += 8;
      const bq = buffer.readDoubleLE(offset);
      offset += 8;
      const sq = buffer.readDoubleLE(offset);
      offset += 8;

      aggs.push({ tp, v, bv, sv, bq, sq });
    }

    return {
      t,
      ct,
      s: symbol,
      i: interval,
      n,
      tv,
      aggs,
    };
  }

  /**
   * Serialize multiple footprints to a single Buffer
   * Each record is prefixed with its size (4 bytes)
   */
  serializeMany(footprints: FootprintData[]): Buffer {
    const buffers: Buffer[] = [];

    for (const fp of footprints) {
      const serialized = this.serialize(fp);
      // Prefix with size
      const sizeBuffer = Buffer.alloc(4);
      sizeBuffer.writeInt32LE(serialized.length, 0);
      buffers.push(sizeBuffer, serialized);
    }

    return Buffer.concat(buffers);
  }

  /**
   * Deserialize Buffer containing multiple footprints
   * Each record is prefixed with its size (4 bytes)
   */
  deserializeMany(
    buffer: Buffer,
    symbol: string,
    interval: string
  ): FootprintData[] {
    const footprints: FootprintData[] = [];
    let offset = 0;

    while (offset < buffer.length) {
      // Read size prefix
      if (offset + 4 > buffer.length) break;
      const size = buffer.readInt32LE(offset);
      offset += 4;

      // Read record
      if (offset + size > buffer.length) break;
      const recordBuffer = buffer.subarray(offset, offset + size);
      footprints.push(this.deserialize(recordBuffer, symbol, interval));
      offset += size;
    }

    return footprints;
  }

  /**
   * Get the size of a serialized footprint from buffer
   * Reads header to determine total size
   */
  getRecordSize(buffer: Buffer, offset: number = 0): number {
    if (buffer.length < offset + HEADER_SIZE) {
      return 0;
    }

    const aggsCount = buffer.readInt32LE(offset + 28); // aggsCount is at offset 28
    return HEADER_SIZE + aggsCount * AGG_SIZE;
  }
}
