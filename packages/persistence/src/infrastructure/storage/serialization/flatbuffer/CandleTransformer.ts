/**
 * Candle Transformer
 * Transforms domain candle objects to/from FlatBuffer-compatible format.
 * Provides a clean separation between domain models and serialization format.
 */

import type { FootprintCandleData } from './FlatBufferSerializer.js';
import type { BinaryCandle, BinaryAggs } from '../binary/schemas/types.js';

/**
 * CandleTransformer
 * Handles conversion between domain candle objects and FlatBuffer-compatible format.
 * This transformer ensures consistent data mapping across the application.
 */
export class CandleTransformer {
  /**
   * Transform domain candle to FlatBuffer-compatible format
   *
   * Converts a BinaryCandle (domain model) to FootprintCandleData (FlatBuffer format).
   * Maps legacy field names to short FlatBuffer field names.
   *
   * @param candle - Domain candle object
   * @returns FlatBuffer-compatible candle data
   */
  static toFlatBufferFormat(candle: BinaryCandle): FootprintCandleData {
    return {
      // Identifiers
      e: candle.e,
      tz: candle.tz,
      ex: candle.exchange || candle.ex,
      a: candle.a,
      s: candle.symbol || candle.s,
      s1: candle.s1,
      s2: candle.s2,
      i: candle.timeframe || candle.i,

      // Time fields
      id: typeof candle.id === 'string' ? parseInt(candle.id, 10) || 0 : 0,
      vi: candle.vi !== undefined ? Number(candle.vi) : undefined,
      t:
        candle.openTime ||
        (candle.t !== undefined ? Number(candle.t) : undefined),
      ct:
        candle.closeTime ||
        (candle.ct !== undefined ? Number(candle.ct) : undefined),
      df: candle.df !== undefined ? Number(candle.df) : undefined,

      // OHLCV
      o: candle.open ?? candle.o,
      h: candle.high ?? candle.h,
      l: candle.low ?? candle.l,
      c: candle.close ?? candle.c,
      v: candle.volume ?? candle.v,

      // Buy/Sell volumes
      bv: candle.buyVolume ?? candle.bv,
      sv: candle.sellVolume ?? candle.sv,

      // Quote volumes
      q: candle.quoteVolume ?? candle.q,
      bq: candle.buyQuoteVolume ?? candle.bq,
      sq: candle.sellQuoteVolume ?? candle.sq,

      // Delta
      d: candle.delta ?? candle.d,
      dMax: candle.deltaMax ?? candle.dMax,
      dMin: candle.deltaMin ?? candle.dMin,

      // Other fields
      n:
        candle.tradeCount ??
        (candle.n !== undefined ? Number(candle.n) : undefined),
      tv: candle.tickValue ?? candle.tv,
      f: candle.firstTradeId ?? candle.f,
      ls: candle.lastTradeId ?? candle.ls,
      x: candle.isComplete ?? candle.x,

      // Footprint data - transform to FlatBuffer aggs format
      aggs: candle.aggs?.map((agg) => CandleTransformer.toFlatBufferAggs(agg)),
    };
  }

  /**
   * Transform FlatBuffer format to domain candle
   *
   * Converts FootprintCandleData (FlatBuffer format) to BinaryCandle (domain model).
   * Maps short FlatBuffer field names to legacy field names.
   *
   * @param data - FlatBuffer-compatible candle data
   * @returns Domain candle object
   */
  static fromFlatBufferFormat(data: FootprintCandleData): BinaryCandle {
    const now = Date.now();

    return {
      // Composite ID
      id: `${data.ex || ''}_${data.s || ''}_${data.i || ''}_${data.t || 0}`,

      // Core identifiers
      symbol: data.s || '',
      exchange: data.ex || '',
      timeframe: data.i || '',

      // Time fields
      openTime: data.t || 0,
      closeTime: data.ct || 0,

      // OHLCV
      open: data.o || 0,
      high: data.h || 0,
      low: data.l || 0,
      close: data.c || 0,
      volume: data.v || 0,

      // Buy/Sell volumes
      buyVolume: data.bv || 0,
      sellVolume: data.sv || 0,

      // Quote volumes
      quoteVolume: data.q || 0,
      buyQuoteVolume: data.bq || 0,
      sellQuoteVolume: data.sq || 0,

      // Trade count
      tradeCount: data.n || 0,

      // Delta
      delta: data.d || 0,
      deltaMax: data.dMax || 0,
      deltaMin: data.dMin || 0,

      // Other fields
      tickValue: data.tv || 0,
      firstTradeId: data.f || 0,
      lastTradeId: data.ls || 0,
      isComplete: data.x || false,

      // Footprint data
      aggs:
        data.aggs?.map((agg) => CandleTransformer.fromFlatBufferAggs(agg)) ||
        [],

      // Metadata
      createdAt: now,
      updatedAt: now,

      // FlatBuffer field names (for backward compatibility)
      e: data.e,
      tz: data.tz,
      ex: data.ex,
      a: data.a,
      s: data.s,
      s1: data.s1,
      s2: data.s2,
      i: data.i,
      vi: data.vi !== undefined ? BigInt(data.vi) : undefined,
      t: data.t !== undefined ? BigInt(data.t) : undefined,
      ct: data.ct !== undefined ? BigInt(data.ct) : undefined,
      df: data.df !== undefined ? BigInt(data.df) : undefined,
      o: data.o,
      h: data.h,
      l: data.l,
      c: data.c,
      v: data.v,
      bv: data.bv,
      sv: data.sv,
      q: data.q,
      bq: data.bq,
      sq: data.sq,
      d: data.d,
      dMax: data.dMax,
      dMin: data.dMin,
      n: data.n !== undefined ? BigInt(data.n) : undefined,
      tv: data.tv,
      f: data.f,
      ls: data.ls,
      x: data.x,
    };
  }

  /**
   * Transform aggregation to FlatBuffer format
   *
   * @param agg - Domain aggregation (BinaryAggs or BinaryPriceBin)
   * @returns FlatBuffer-compatible aggregation
   */
  private static toFlatBufferAggs(
    agg:
      | BinaryAggs
      | {
          price?: number;
          buyVolume?: number;
          sellVolume?: number;
          buyQuote?: number;
          sellQuote?: number;
          volume?: number;
        }
  ): { tp: number; v: number; bv: number; sv: number; bq: number; sq: number } {
    // Handle BinaryAggs format
    if ('tp' in agg) {
      return {
        tp: agg.tp,
        v: agg.v,
        bv: agg.bv,
        sv: agg.sv,
        bq: agg.bq,
        sq: agg.sq,
      };
    }

    // Handle BinaryPriceBin format (legacy)
    return {
      tp: agg.price || 0,
      v: agg.volume || 0,
      bv: agg.buyVolume || 0,
      sv: agg.sellVolume || 0,
      bq: agg.buyQuote || 0,
      sq: agg.sellQuote || 0,
    };
  }

  /**
   * Transform FlatBuffer aggregation to domain format
   *
   * @param agg - FlatBuffer aggregation
   * @returns Domain aggregation (BinaryAggs)
   */
  private static fromFlatBufferAggs(agg: {
    tp: number;
    v: number;
    bv: number;
    sv: number;
    bq: number;
    sq: number;
  }): BinaryAggs {
    return {
      tp: agg.tp,
      v: agg.v,
      bv: agg.bv,
      sv: agg.sv,
      bq: agg.bq,
      sq: agg.sq,
    };
  }
}
