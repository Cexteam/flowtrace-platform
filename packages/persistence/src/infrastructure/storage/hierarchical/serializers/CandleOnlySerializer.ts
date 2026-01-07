/**
 * CandleOnlySerializer
 *
 * Serializes CandleData (OHLCV only) to binary format.
 * Uses a simple binary format for now, can be upgraded to FlatBuffer later.
 *
 * Binary format (fixed 128 bytes per record):
 * - t: int64 (8 bytes) - Open timestamp
 * - ct: int64 (8 bytes) - Close timestamp
 * - o: float64 (8 bytes) - Open price
 * - h: float64 (8 bytes) - High price
 * - l: float64 (8 bytes) - Low price
 * - c: float64 (8 bytes) - Close price
 * - v: float64 (8 bytes) - Volume
 * - bv: float64 (8 bytes) - Buy volume
 * - sv: float64 (8 bytes) - Sell volume
 * - q: float64 (8 bytes) - Quote volume
 * - bq: float64 (8 bytes) - Buy quote volume
 * - sq: float64 (8 bytes) - Sell quote volume
 * - d: float64 (8 bytes) - Delta
 * - dMax: float64 (8 bytes) - Delta max
 * - dMin: float64 (8 bytes) - Delta min
 * - n: int32 (4 bytes) - Number of trades
 * - reserved: 4 bytes
 */

import type { CandleData } from '../types.js';

/** Fixed record size in bytes */
export const CANDLE_RECORD_SIZE = 128;

/**
 * CandleOnlySerializer
 * Serializes/deserializes CandleData to binary format
 */
export class CandleOnlySerializer {
  /**
   * Serialize CandleData to Buffer
   */
  serialize(data: CandleData): Buffer {
    const buffer = Buffer.alloc(CANDLE_RECORD_SIZE);
    let offset = 0;

    // Timestamps (16 bytes)
    buffer.writeBigInt64LE(BigInt(data.t), offset);
    offset += 8;
    buffer.writeBigInt64LE(BigInt(data.ct), offset);
    offset += 8;

    // OHLC (32 bytes)
    buffer.writeDoubleLE(data.o, offset);
    offset += 8;
    buffer.writeDoubleLE(data.h, offset);
    offset += 8;
    buffer.writeDoubleLE(data.l, offset);
    offset += 8;
    buffer.writeDoubleLE(data.c, offset);
    offset += 8;

    // Volumes (48 bytes)
    buffer.writeDoubleLE(data.v, offset);
    offset += 8;
    buffer.writeDoubleLE(data.bv, offset);
    offset += 8;
    buffer.writeDoubleLE(data.sv, offset);
    offset += 8;
    buffer.writeDoubleLE(data.q, offset);
    offset += 8;
    buffer.writeDoubleLE(data.bq, offset);
    offset += 8;
    buffer.writeDoubleLE(data.sq, offset);
    offset += 8;

    // Delta (24 bytes)
    buffer.writeDoubleLE(data.d, offset);
    offset += 8;
    buffer.writeDoubleLE(data.dMax, offset);
    offset += 8;
    buffer.writeDoubleLE(data.dMin, offset);
    offset += 8;

    // Trade count (4 bytes)
    buffer.writeInt32LE(data.n, offset);
    // offset += 4;

    // Reserved 4 bytes already zeroed

    return buffer;
  }

  /**
   * Deserialize Buffer to CandleData
   * Note: symbol and interval must be provided from context
   */
  deserialize(buffer: Buffer, symbol: string, interval: string): CandleData {
    if (buffer.length < CANDLE_RECORD_SIZE) {
      throw new Error(
        `Buffer too small: expected ${CANDLE_RECORD_SIZE}, got ${buffer.length}`
      );
    }

    let offset = 0;

    // Timestamps
    const t = Number(buffer.readBigInt64LE(offset));
    offset += 8;
    const ct = Number(buffer.readBigInt64LE(offset));
    offset += 8;

    // OHLC
    const o = buffer.readDoubleLE(offset);
    offset += 8;
    const h = buffer.readDoubleLE(offset);
    offset += 8;
    const l = buffer.readDoubleLE(offset);
    offset += 8;
    const c = buffer.readDoubleLE(offset);
    offset += 8;

    // Volumes
    const v = buffer.readDoubleLE(offset);
    offset += 8;
    const bv = buffer.readDoubleLE(offset);
    offset += 8;
    const sv = buffer.readDoubleLE(offset);
    offset += 8;
    const q = buffer.readDoubleLE(offset);
    offset += 8;
    const bq = buffer.readDoubleLE(offset);
    offset += 8;
    const sq = buffer.readDoubleLE(offset);
    offset += 8;

    // Delta
    const d = buffer.readDoubleLE(offset);
    offset += 8;
    const dMax = buffer.readDoubleLE(offset);
    offset += 8;
    const dMin = buffer.readDoubleLE(offset);
    offset += 8;

    // Trade count
    const n = buffer.readInt32LE(offset);

    return {
      t,
      ct,
      s: symbol,
      i: interval,
      o,
      h,
      l,
      c,
      v,
      bv,
      sv,
      q,
      bq,
      sq,
      d,
      dMax,
      dMin,
      n,
    };
  }

  /**
   * Serialize multiple candles to a single Buffer
   */
  serializeMany(candles: CandleData[]): Buffer {
    const buffers = candles.map((c) => this.serialize(c));
    return Buffer.concat(buffers);
  }

  /**
   * Deserialize Buffer containing multiple candles
   */
  deserializeMany(
    buffer: Buffer,
    symbol: string,
    interval: string
  ): CandleData[] {
    const candles: CandleData[] = [];
    const count = Math.floor(buffer.length / CANDLE_RECORD_SIZE);

    for (let i = 0; i < count; i++) {
      const start = i * CANDLE_RECORD_SIZE;
      const recordBuffer = buffer.subarray(start, start + CANDLE_RECORD_SIZE);
      candles.push(this.deserialize(recordBuffer, symbol, interval));
    }

    return candles;
  }
}
