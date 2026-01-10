/**
 * CompressedCandleSerializerAdapter
 *
 * Infrastructure adapter implementing CompressedCandleSerializerPort.
 * Uses FlatBuffer + LZ4 compression for optimal storage efficiency.
 *
 * Format: FTCF (FlowTrace Candle Full)
 * - Magic bytes: "FTCF" (0x46 0x54 0x43 0x46)
 * - Payload: LZ4 compressed FlatBuffer data
 *
 * Performance targets:
 * - Serialize: < 2ms for 50-agg candle
 * - Deserialize: < 1ms for 50-agg candle
 * - Compression ratio: > 4:1 vs JSON
 */

import { injectable } from 'inversify';
import * as lz4 from 'lz4-napi';
import type { FootprintCandle } from '@flowtrace/core';
import type {
  CompressedCandleSerializerPort,
  SerializeResult,
  DeserializeResult,
  DeserializeBatchResult,
  DeserializeCandleOnlyResult,
  DeserializeFootprintOnlyResult,
  CandleOnlyData,
  FootprintOnlyData,
} from '../../../application/ports/out/CompressedCandleSerializerPort.js';
import {
  FlatBufferSerializer,
  type FootprintCandleData,
} from '../../../../../infrastructure/storage/serialization/flatbuffer/FlatBufferSerializer.js';
import { FlatBufferCandleOnlySerializer } from '../../../../../infrastructure/storage/serialization/flatbuffer/FlatBufferCandleOnlySerializer.js';
import { FlatBufferFootprintOnlySerializer } from '../../../../../infrastructure/storage/serialization/flatbuffer/FlatBufferFootprintOnlySerializer.js';

/**
 * Magic bytes for FTCF format identification
 * "FTCF" = FlowTrace Candle Full (Full FootprintCandle)
 */
const MAGIC_FTCF = Buffer.from([0x46, 0x54, 0x43, 0x46]); // "FTCF"

/**
 * Magic bytes for FTCO format identification
 * "FTCO" = FlatTrace Compressed Only (CandleOnly - OHLCV without footprint)
 */
const MAGIC_FTCO = Buffer.from([0x46, 0x54, 0x43, 0x4f]); // "FTCO"

/**
 * Magic bytes for FTFO format identification
 * "FTFO" = FlatTrace Footprint Only (FootprintOnly - aggregations without OHLCV)
 */
const MAGIC_FTFO = Buffer.from([0x46, 0x54, 0x46, 0x4f]); // "FTFO"

const MAGIC_LENGTH = 4;

/**
 * CompressedCandleSerializerAdapter
 *
 * Implements FlatBuffer + LZ4 compression for candle serialization.
 * Provides unified serialization logic for both SQLite and File storage modes.
 */
@injectable()
export class CompressedCandleSerializerAdapter
  implements CompressedCandleSerializerPort
{
  /**
   * Serialize FootprintCandle to compressed binary format
   *
   * Flow: Candle → FlatBuffer → LZ4 → Magic + Data
   */
  serialize(candle: FootprintCandle): SerializeResult {
    const startSerialize = performance.now();

    // Step 1: Convert to FlatBuffer
    const candleData = this.toFlatBufferData(candle);
    const flatBuffer = FlatBufferSerializer.serializeCandle(candleData);
    const serializeMs = performance.now() - startSerialize;

    // Step 2: Compress with LZ4
    const startCompress = performance.now();
    const compressed = lz4.compressSync(flatBuffer);
    const compressMs = performance.now() - startCompress;

    // Step 3: Prepend magic bytes
    const result = Buffer.concat([MAGIC_FTCF, compressed]);

    return {
      buffer: result,
      metrics: {
        serializeMs,
        compressMs,
        rawSize: flatBuffer.length,
        compressedSize: result.length,
        compressionRatio: flatBuffer.length / result.length,
      },
    };
  }

  /**
   * Serialize multiple candles as a batch
   */
  serializeBatch(candles: FootprintCandle[]): SerializeResult {
    const startSerialize = performance.now();

    // Convert all candles to FlatBuffer batch
    const candleDataArray = candles.map((c) => this.toFlatBufferData(c));
    const flatBuffer =
      FlatBufferSerializer.serializeCandleBatch(candleDataArray);
    const serializeMs = performance.now() - startSerialize;

    // Compress
    const startCompress = performance.now();
    const compressed = lz4.compressSync(flatBuffer);
    const compressMs = performance.now() - startCompress;

    // Prepend magic bytes
    const result = Buffer.concat([MAGIC_FTCF, compressed]);

    return {
      buffer: result,
      metrics: {
        serializeMs,
        compressMs,
        rawSize: flatBuffer.length,
        compressedSize: result.length,
        compressionRatio: flatBuffer.length / result.length,
      },
    };
  }

  /**
   * Deserialize buffer to FootprintCandle
   *
   * Expects FTCF format (magic bytes + LZ4 compressed FlatBuffer).
   */
  deserialize(buffer: Buffer): DeserializeResult {
    // Verify magic bytes
    this.verifyMagicBytes(buffer);

    // Step 1: Decompress LZ4
    const startDecompress = performance.now();
    const compressed = buffer.subarray(MAGIC_LENGTH);
    const decompressed = lz4.uncompressSync(compressed);
    const decompressMs = performance.now() - startDecompress;

    // Step 2: Deserialize FlatBuffer
    const startDeserialize = performance.now();
    const candleData = FlatBufferSerializer.deserializeCandle(
      Buffer.from(decompressed)
    );
    const candle = this.fromFlatBufferData(candleData);
    const deserializeMs = performance.now() - startDeserialize;

    return {
      candle,
      metrics: { decompressMs, deserializeMs },
    };
  }

  /**
   * Deserialize batch of candles from buffer
   */
  deserializeBatch(buffer: Buffer): DeserializeBatchResult {
    // Verify magic bytes
    this.verifyMagicBytes(buffer);

    // Step 1: Decompress LZ4
    const startDecompress = performance.now();
    const compressed = buffer.subarray(MAGIC_LENGTH);
    const decompressed = lz4.uncompressSync(compressed);
    const decompressMs = performance.now() - startDecompress;

    // Step 2: Deserialize FlatBuffer batch
    const startDeserialize = performance.now();
    const candleDataArray = FlatBufferSerializer.deserializeCandleBatch(
      Buffer.from(decompressed)
    );
    const candles = candleDataArray.map((data) =>
      this.fromFlatBufferData(data)
    );
    const deserializeMs = performance.now() - startDeserialize;

    return {
      candles,
      metrics: { decompressMs, deserializeMs },
    };
  }

  /**
   * Verify FTCF magic bytes
   */
  private verifyMagicBytes(buffer: Buffer): void {
    if (buffer.length < MAGIC_LENGTH) {
      throw new Error(
        `Invalid FTCF format: buffer too short (${buffer.length} bytes, expected at least ${MAGIC_LENGTH})`
      );
    }

    const magic = buffer.subarray(0, MAGIC_LENGTH);
    if (!magic.equals(MAGIC_FTCF)) {
      const hexDump = buffer.subarray(0, 16).toString('hex');
      throw new Error(
        `Invalid FTCF format: incorrect magic bytes. Expected "FTCF" (46544346), got: ${hexDump}`
      );
    }
  }

  // ============================================================================
  // CandleOnly methods (FTCO format)
  // ============================================================================

  /**
   * Serialize CandleOnlyData to compressed binary format (FTCO)
   */
  serializeCandleOnly(data: CandleOnlyData): SerializeResult {
    const startSerialize = performance.now();

    // Step 1: Serialize to FlatBuffer
    const flatBuffer = FlatBufferCandleOnlySerializer.serialize(data);
    const serializeMs = performance.now() - startSerialize;

    // Step 2: Compress with LZ4
    const startCompress = performance.now();
    const compressed = lz4.compressSync(flatBuffer);
    const compressMs = performance.now() - startCompress;

    // Step 3: Prepend magic bytes
    const result = Buffer.concat([MAGIC_FTCO, compressed]);

    return {
      buffer: result,
      metrics: {
        serializeMs,
        compressMs,
        rawSize: flatBuffer.length,
        compressedSize: result.length,
        compressionRatio: flatBuffer.length / result.length,
      },
    };
  }

  /**
   * Deserialize buffer to CandleOnlyData
   */
  deserializeCandleOnly(buffer: Buffer): DeserializeCandleOnlyResult {
    // Verify magic bytes
    this.verifyMagicBytesFTCO(buffer);

    // Step 1: Decompress LZ4
    const startDecompress = performance.now();
    const compressed = buffer.subarray(MAGIC_LENGTH);
    const decompressed = lz4.uncompressSync(compressed);
    const decompressMs = performance.now() - startDecompress;

    // Step 2: Deserialize FlatBuffer
    const startDeserialize = performance.now();
    const data = FlatBufferCandleOnlySerializer.deserialize(
      Buffer.from(decompressed)
    );
    const deserializeMs = performance.now() - startDeserialize;

    return {
      data,
      metrics: { decompressMs, deserializeMs },
    };
  }

  /**
   * Verify FTCO magic bytes
   */
  private verifyMagicBytesFTCO(buffer: Buffer): void {
    if (buffer.length < MAGIC_LENGTH) {
      throw new Error(
        `Invalid FTCO format: buffer too short (${buffer.length} bytes, expected at least ${MAGIC_LENGTH})`
      );
    }

    const magic = buffer.subarray(0, MAGIC_LENGTH);
    if (!magic.equals(MAGIC_FTCO)) {
      const hexDump = buffer.subarray(0, 16).toString('hex');
      throw new Error(
        `Invalid FTCO format: incorrect magic bytes. Expected "FTCO" (4654434f), got: ${hexDump}`
      );
    }
  }

  // ============================================================================
  // FootprintOnly methods (FTFO format)
  // ============================================================================

  /**
   * Serialize FootprintOnlyData to compressed binary format (FTFO)
   */
  serializeFootprintOnly(data: FootprintOnlyData): SerializeResult {
    const startSerialize = performance.now();

    // Step 1: Serialize to FlatBuffer
    const flatBuffer = FlatBufferFootprintOnlySerializer.serialize(data);
    const serializeMs = performance.now() - startSerialize;

    // Step 2: Compress with LZ4
    const startCompress = performance.now();
    const compressed = lz4.compressSync(flatBuffer);
    const compressMs = performance.now() - startCompress;

    // Step 3: Prepend magic bytes
    const result = Buffer.concat([MAGIC_FTFO, compressed]);

    return {
      buffer: result,
      metrics: {
        serializeMs,
        compressMs,
        rawSize: flatBuffer.length,
        compressedSize: result.length,
        compressionRatio: flatBuffer.length / result.length,
      },
    };
  }

  /**
   * Deserialize buffer to FootprintOnlyData
   */
  deserializeFootprintOnly(buffer: Buffer): DeserializeFootprintOnlyResult {
    // Verify magic bytes
    this.verifyMagicBytesFTFO(buffer);

    // Step 1: Decompress LZ4
    const startDecompress = performance.now();
    const compressed = buffer.subarray(MAGIC_LENGTH);
    const decompressed = lz4.uncompressSync(compressed);
    const decompressMs = performance.now() - startDecompress;

    // Step 2: Deserialize FlatBuffer
    const startDeserialize = performance.now();
    const data = FlatBufferFootprintOnlySerializer.deserialize(
      Buffer.from(decompressed)
    );
    const deserializeMs = performance.now() - startDeserialize;

    return {
      data,
      metrics: { decompressMs, deserializeMs },
    };
  }

  /**
   * Verify FTFO magic bytes
   */
  private verifyMagicBytesFTFO(buffer: Buffer): void {
    if (buffer.length < MAGIC_LENGTH) {
      throw new Error(
        `Invalid FTFO format: buffer too short (${buffer.length} bytes, expected at least ${MAGIC_LENGTH})`
      );
    }

    const magic = buffer.subarray(0, MAGIC_LENGTH);
    if (!magic.equals(MAGIC_FTFO)) {
      const hexDump = buffer.subarray(0, 16).toString('hex');
      throw new Error(
        `Invalid FTFO format: incorrect magic bytes. Expected "FTFO" (4654464f), got: ${hexDump}`
      );
    }
  }

  /**
   * Convert FootprintCandle to FlatBuffer-compatible data
   *
   * Symbol fields:
   * - s: Primary trading symbol/contract (e.g., "BTCUSDT", "VN30F2501", "HPG")
   * - s1: Underlying/root symbol for linking related instruments (e.g., "BTC", "VN30")
   */
  private toFlatBufferData(candle: FootprintCandle): FootprintCandleData {
    return {
      e: candle.e,
      tz: candle.tz,
      ex: candle.ex,
      a: candle.a,
      s: candle.s,
      s1: (candle as FootprintCandleData).s1, // Underlying/root symbol
      i: candle.i,
      vi: candle.vi,
      t: candle.t,
      ct: candle.ct,
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
      n: candle.n,
      d: candle.d,
      dMax: candle.dMax,
      dMin: candle.dMin,
      tv: candle.tv,
      bm: candle.bm,
      f: candle.f,
      ls: candle.ls,
      x: candle.x,
      aggs: candle.aggs?.map((agg) => ({
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
   * Convert FlatBuffer data back to FootprintCandle
   *
   * Symbol fields:
   * - s: Primary trading symbol/contract (e.g., "BTCUSDT", "VN30F2501", "HPG")
   * - s1: Underlying/root symbol for linking related instruments (e.g., "BTC", "VN30")
   */
  private fromFlatBufferData(data: FootprintCandleData): FootprintCandle {
    const candle = {
      e: data.e || 'CANDLESTICK',
      tz: data.tz || 'UTC',
      ex: data.ex || '',
      a: data.a || '',
      s: data.s || '',
      i: data.i || '',
      vi: data.vi || 0,
      t: data.t || 0,
      ct: data.ct || 0,
      o: data.o || 0,
      h: data.h || 0,
      l: data.l || 0,
      c: data.c || 0,
      v: data.v || 0,
      bv: data.bv || 0,
      sv: data.sv || 0,
      q: data.q || 0,
      bq: data.bq || 0,
      sq: data.sq || 0,
      n: data.n || 0,
      d: data.d || 0,
      dMax: data.dMax || 0,
      dMin: data.dMin || 0,
      tv: data.tv || 0,
      bm: data.bm || 1,
      f: data.f || 0,
      ls: data.ls || 0,
      x: data.x || false,
      aggs: data.aggs || [],
    } as FootprintCandle;

    // Add s1 (underlying/root symbol) if present
    if (data.s1) {
      (candle as FootprintCandleData).s1 = data.s1;
    }

    return candle;
  }
}

/**
 * Export magic bytes constants for external use (e.g., format detection)
 */
export { MAGIC_FTCF, MAGIC_FTCO, MAGIC_FTFO, MAGIC_LENGTH };
