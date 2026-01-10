/**
 * FlatBuffer CandleOnly Serializer
 *
 * Optimized serializer for OHLCV candle data without footprint aggregations.
 * Uses CandleOnly FlatBuffer schema for minimal storage footprint.
 *
 * Magic bytes: FTCO (0x46 0x54 0x43 0x4F)
 */

import * as flatbuffers from 'flatbuffers';
import { CandleOnly } from './schemas/generated/candle_only/candle-only.js';
import { CandleOnlyBatch } from './schemas/generated/candle_only/candle-only-batch.js';

/**
 * CandleOnly data interface - OHLCV without footprint
 */
export interface CandleOnlyData {
  // Time fields
  t: number; // open timestamp
  ct: number; // close timestamp

  // Identifiers
  s: string; // symbol
  s1?: string; // underlying/root symbol
  i: string; // interval

  // OHLCV
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume

  // Buy/Sell volumes
  bv: number; // buy volume
  sv: number; // sell volume

  // Quote volumes
  q: number; // quote volume
  bq: number; // buy quote volume
  sq: number; // sell quote volume

  // Delta
  d: number; // delta
  dMax: number; // delta max
  dMin: number; // delta min

  // Trade count
  n: number; // number of trades
}

/**
 * FlatBuffer CandleOnly Serializer
 */
export class FlatBufferCandleOnlySerializer {
  /**
   * Serialize CandleOnlyData to FlatBuffer format
   */
  static serialize(candle: CandleOnlyData): Buffer {
    const builder = new flatbuffers.Builder(512);

    // Create string offsets
    const sOffset = builder.createString(candle.s);
    const s1Offset = candle.s1 ? builder.createString(candle.s1) : 0;
    const iOffset = builder.createString(candle.i);

    // Build CandleOnly
    CandleOnly.startCandleOnly(builder);
    CandleOnly.addT(builder, BigInt(candle.t));
    CandleOnly.addCt(builder, BigInt(candle.ct));
    CandleOnly.addS(builder, sOffset);
    if (s1Offset) CandleOnly.addS1(builder, s1Offset);
    CandleOnly.addI(builder, iOffset);
    CandleOnly.addO(builder, candle.o);
    CandleOnly.addH(builder, candle.h);
    CandleOnly.addL(builder, candle.l);
    CandleOnly.addC(builder, candle.c);
    CandleOnly.addV(builder, candle.v);
    CandleOnly.addBv(builder, candle.bv);
    CandleOnly.addSv(builder, candle.sv);
    CandleOnly.addQ(builder, candle.q);
    CandleOnly.addBq(builder, candle.bq);
    CandleOnly.addSq(builder, candle.sq);
    CandleOnly.addD(builder, candle.d);
    CandleOnly.addDMax(builder, candle.dMax);
    CandleOnly.addDMin(builder, candle.dMin);
    CandleOnly.addN(builder, BigInt(candle.n));

    const candleOffset = CandleOnly.endCandleOnly(builder);
    builder.finish(candleOffset);

    return Buffer.from(builder.asUint8Array());
  }

  /**
   * Deserialize FlatBuffer to CandleOnlyData
   */
  static deserialize(buffer: Buffer): CandleOnlyData {
    const bytes = new Uint8Array(buffer);
    const byteBuffer = new flatbuffers.ByteBuffer(bytes);
    const fb = CandleOnly.getRootAsCandleOnly(byteBuffer);

    return {
      t: Number(fb.t()),
      ct: Number(fb.ct()),
      s: fb.s() || '',
      s1: fb.s1() || undefined,
      i: fb.i() || '',
      o: fb.o(),
      h: fb.h(),
      l: fb.l(),
      c: fb.c(),
      v: fb.v(),
      bv: fb.bv(),
      sv: fb.sv(),
      q: fb.q(),
      bq: fb.bq(),
      sq: fb.sq(),
      d: fb.d(),
      dMax: fb.dMax(),
      dMin: fb.dMin(),
      n: Number(fb.n()),
    };
  }

  /**
   * Serialize multiple candles to FlatBuffer batch format
   */
  static serializeBatch(candles: CandleOnlyData[]): Buffer {
    const builder = new flatbuffers.Builder(512 * candles.length);

    // Build each candle and collect offsets
    const candleOffsets: flatbuffers.Offset[] = [];
    for (const candle of candles) {
      const sOffset = builder.createString(candle.s);
      const s1Offset = candle.s1 ? builder.createString(candle.s1) : 0;
      const iOffset = builder.createString(candle.i);

      CandleOnly.startCandleOnly(builder);
      CandleOnly.addT(builder, BigInt(candle.t));
      CandleOnly.addCt(builder, BigInt(candle.ct));
      CandleOnly.addS(builder, sOffset);
      if (s1Offset) CandleOnly.addS1(builder, s1Offset);
      CandleOnly.addI(builder, iOffset);
      CandleOnly.addO(builder, candle.o);
      CandleOnly.addH(builder, candle.h);
      CandleOnly.addL(builder, candle.l);
      CandleOnly.addC(builder, candle.c);
      CandleOnly.addV(builder, candle.v);
      CandleOnly.addBv(builder, candle.bv);
      CandleOnly.addSv(builder, candle.sv);
      CandleOnly.addQ(builder, candle.q);
      CandleOnly.addBq(builder, candle.bq);
      CandleOnly.addSq(builder, candle.sq);
      CandleOnly.addD(builder, candle.d);
      CandleOnly.addDMax(builder, candle.dMax);
      CandleOnly.addDMin(builder, candle.dMin);
      CandleOnly.addN(builder, BigInt(candle.n));

      candleOffsets.push(CandleOnly.endCandleOnly(builder));
    }

    // Create batch
    const candlesVector = CandleOnlyBatch.createCandlesVector(
      builder,
      candleOffsets
    );
    const batchOffset = CandleOnlyBatch.createCandleOnlyBatch(
      builder,
      candlesVector,
      candles.length
    );

    builder.finish(batchOffset);
    return Buffer.from(builder.asUint8Array());
  }

  /**
   * Deserialize FlatBuffer batch to CandleOnlyData array
   */
  static deserializeBatch(buffer: Buffer): CandleOnlyData[] {
    const bytes = new Uint8Array(buffer);
    const byteBuffer = new flatbuffers.ByteBuffer(bytes);
    const batch = CandleOnlyBatch.getRootAsCandleOnlyBatch(byteBuffer);

    const candles: CandleOnlyData[] = [];
    for (let i = 0; i < batch.candlesLength(); i++) {
      const fb = batch.candles(i);
      if (fb) {
        candles.push({
          t: Number(fb.t()),
          ct: Number(fb.ct()),
          s: fb.s() || '',
          s1: fb.s1() || undefined,
          i: fb.i() || '',
          o: fb.o(),
          h: fb.h(),
          l: fb.l(),
          c: fb.c(),
          v: fb.v(),
          bv: fb.bv(),
          sv: fb.sv(),
          q: fb.q(),
          bq: fb.bq(),
          sq: fb.sq(),
          d: fb.d(),
          dMax: fb.dMax(),
          dMin: fb.dMin(),
          n: Number(fb.n()),
        });
      }
    }

    return candles;
  }
}
