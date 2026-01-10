/**
 * FlatBuffer FootprintOnly Serializer
 *
 * Optimized serializer for footprint aggregation data without OHLCV.
 * Uses FootprintOnly FlatBuffer schema for minimal storage footprint.
 *
 * Magic bytes: FTFO (0x46 0x54 0x46 0x4F)
 */

import * as flatbuffers from 'flatbuffers';
import { FootprintOnly } from './schemas/generated/footprint_only/footprint-only.js';
import { FootprintAgg } from './schemas/generated/footprint_only/footprint-agg.js';
import { FootprintOnlyBatch } from './schemas/generated/footprint_only/footprint-only-batch.js';

/**
 * Footprint aggregation data
 */
export interface FootprintAggData {
  tp: number; // tick price
  v: number; // volume
  bv: number; // buy volume
  sv: number; // sell volume
  bq: number; // buy quote
  sq: number; // sell quote
}

/**
 * FootprintOnly data interface - aggregations without OHLCV
 */
export interface FootprintOnlyData {
  // Time fields
  t: number; // open timestamp
  ct: number; // close timestamp

  // Identifiers
  s: string; // symbol
  s1?: string; // underlying/root symbol
  i: string; // interval

  // Footprint metadata
  n: number; // number of trades
  tv: number; // tick value
  bm: number; // bin multiplier

  // Aggregations
  aggs: FootprintAggData[];
}

/**
 * FlatBuffer FootprintOnly Serializer
 */
export class FlatBufferFootprintOnlySerializer {
  /**
   * Serialize FootprintOnlyData to FlatBuffer format
   */
  static serialize(footprint: FootprintOnlyData): Buffer {
    const builder = new flatbuffers.Builder(1024 + footprint.aggs.length * 64);

    // Create agg offsets
    const aggOffsets: flatbuffers.Offset[] = [];
    for (const agg of footprint.aggs) {
      const aggOffset = FootprintAgg.createFootprintAgg(
        builder,
        agg.tp,
        agg.v,
        agg.bv,
        agg.sv,
        agg.bq,
        agg.sq
      );
      aggOffsets.push(aggOffset);
    }

    // Create aggs vector
    const aggsVector = FootprintOnly.createAggsVector(builder, aggOffsets);

    // Create string offsets
    const sOffset = builder.createString(footprint.s);
    const s1Offset = footprint.s1 ? builder.createString(footprint.s1) : 0;
    const iOffset = builder.createString(footprint.i);

    // Build FootprintOnly
    FootprintOnly.startFootprintOnly(builder);
    FootprintOnly.addT(builder, BigInt(footprint.t));
    FootprintOnly.addCt(builder, BigInt(footprint.ct));
    FootprintOnly.addS(builder, sOffset);
    if (s1Offset) FootprintOnly.addS1(builder, s1Offset);
    FootprintOnly.addI(builder, iOffset);
    FootprintOnly.addN(builder, BigInt(footprint.n));
    FootprintOnly.addTv(builder, footprint.tv);
    FootprintOnly.addBm(builder, footprint.bm);
    FootprintOnly.addAggs(builder, aggsVector);

    const footprintOffset = FootprintOnly.endFootprintOnly(builder);
    builder.finish(footprintOffset);

    return Buffer.from(builder.asUint8Array());
  }

  /**
   * Deserialize FlatBuffer to FootprintOnlyData
   */
  static deserialize(buffer: Buffer): FootprintOnlyData {
    const bytes = new Uint8Array(buffer);
    const byteBuffer = new flatbuffers.ByteBuffer(bytes);
    const fb = FootprintOnly.getRootAsFootprintOnly(byteBuffer);

    // Extract aggs
    const aggs: FootprintAggData[] = [];
    for (let i = 0; i < fb.aggsLength(); i++) {
      const agg = fb.aggs(i);
      if (agg) {
        aggs.push({
          tp: agg.tp(),
          v: agg.v(),
          bv: agg.bv(),
          sv: agg.sv(),
          bq: agg.bq(),
          sq: agg.sq(),
        });
      }
    }

    return {
      t: Number(fb.t()),
      ct: Number(fb.ct()),
      s: fb.s() || '',
      s1: fb.s1() || undefined,
      i: fb.i() || '',
      n: Number(fb.n()),
      tv: fb.tv(),
      bm: fb.bm(),
      aggs,
    };
  }

  /**
   * Serialize multiple footprints to FlatBuffer batch format
   */
  static serializeBatch(footprints: FootprintOnlyData[]): Buffer {
    // Estimate buffer size
    let totalAggs = 0;
    for (const fp of footprints) {
      totalAggs += fp.aggs.length;
    }
    const builder = new flatbuffers.Builder(
      1024 * footprints.length + totalAggs * 64
    );

    // Build each footprint and collect offsets
    const footprintOffsets: flatbuffers.Offset[] = [];
    for (const footprint of footprints) {
      // Create agg offsets
      const aggOffsets: flatbuffers.Offset[] = [];
      for (const agg of footprint.aggs) {
        const aggOffset = FootprintAgg.createFootprintAgg(
          builder,
          agg.tp,
          agg.v,
          agg.bv,
          agg.sv,
          agg.bq,
          agg.sq
        );
        aggOffsets.push(aggOffset);
      }

      // Create aggs vector
      const aggsVector = FootprintOnly.createAggsVector(builder, aggOffsets);

      // Create string offsets
      const sOffset = builder.createString(footprint.s);
      const s1Offset = footprint.s1 ? builder.createString(footprint.s1) : 0;
      const iOffset = builder.createString(footprint.i);

      // Build FootprintOnly
      FootprintOnly.startFootprintOnly(builder);
      FootprintOnly.addT(builder, BigInt(footprint.t));
      FootprintOnly.addCt(builder, BigInt(footprint.ct));
      FootprintOnly.addS(builder, sOffset);
      if (s1Offset) FootprintOnly.addS1(builder, s1Offset);
      FootprintOnly.addI(builder, iOffset);
      FootprintOnly.addN(builder, BigInt(footprint.n));
      FootprintOnly.addTv(builder, footprint.tv);
      FootprintOnly.addBm(builder, footprint.bm);
      FootprintOnly.addAggs(builder, aggsVector);

      footprintOffsets.push(FootprintOnly.endFootprintOnly(builder));
    }

    // Create batch
    const footprintsVector = FootprintOnlyBatch.createFootprintsVector(
      builder,
      footprintOffsets
    );
    const batchOffset = FootprintOnlyBatch.createFootprintOnlyBatch(
      builder,
      footprintsVector,
      footprints.length
    );

    builder.finish(batchOffset);
    return Buffer.from(builder.asUint8Array());
  }

  /**
   * Deserialize FlatBuffer batch to FootprintOnlyData array
   */
  static deserializeBatch(buffer: Buffer): FootprintOnlyData[] {
    const bytes = new Uint8Array(buffer);
    const byteBuffer = new flatbuffers.ByteBuffer(bytes);
    const batch = FootprintOnlyBatch.getRootAsFootprintOnlyBatch(byteBuffer);

    const footprints: FootprintOnlyData[] = [];
    for (let i = 0; i < batch.footprintsLength(); i++) {
      const fb = batch.footprints(i);
      if (fb) {
        // Extract aggs
        const aggs: FootprintAggData[] = [];
        for (let j = 0; j < fb.aggsLength(); j++) {
          const agg = fb.aggs(j);
          if (agg) {
            aggs.push({
              tp: agg.tp(),
              v: agg.v(),
              bv: agg.bv(),
              sv: agg.sv(),
              bq: agg.bq(),
              sq: agg.sq(),
            });
          }
        }

        footprints.push({
          t: Number(fb.t()),
          ct: Number(fb.ct()),
          s: fb.s() || '',
          s1: fb.s1() || undefined,
          i: fb.i() || '',
          n: Number(fb.n()),
          tv: fb.tv(),
          bm: fb.bm(),
          aggs,
        });
      }
    }

    return footprints;
  }
}
