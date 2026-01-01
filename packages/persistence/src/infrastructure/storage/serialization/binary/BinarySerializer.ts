/**
 * Binary Serializer
 * Wrapper for FlatBuffer serialization with file format handling.
 * Adds header (magic bytes + length) to FlatBuffer payload.
 */

import { FlatBufferSerializer } from '../flatbuffer/FlatBufferSerializer.js';

const MAGIC_BYTES = {
  TRADE: Buffer.from([0x46, 0x42, 0x54, 0x52]), // "FBTR"
  CANDLE: Buffer.from([0x46, 0x42, 0x43, 0x44]), // "FBCD"
};

const HEADER_SIZE = 8; // magic (4 bytes) + length (4 bytes)

export class BinarySerializer {
  /**
   * Serialize data to binary format with header
   * For candles, accepts either:
   * - Single candle object (with ex, s, i, t properties)
   * - CandleFile structure with blocks containing candles
   */
  static serialize(data: unknown, type: 'trade' | 'candle'): Buffer {
    let payload: Buffer;

    if (type === 'candle') {
      const allCandles: unknown[] = [];

      // Check if data is a CandleFile structure or a single candle
      const maybeFile = data as {
        blocks?: Array<{ candles?: unknown[] }>;
        ex?: string;
        s?: string;
      };

      if (maybeFile.blocks) {
        // CandleFile structure - extract all candles from blocks
        for (const block of maybeFile.blocks) {
          if (block.candles) {
            allCandles.push(...block.candles);
          }
        }
      } else if (maybeFile.ex || maybeFile.s) {
        // Single candle object
        allCandles.push(data);
      }

      // Use batch serialization
      payload = FlatBufferSerializer.serializeCandleBatch(
        allCandles.map((c) => this.binaryToCandleData(c))
      );
    } else {
      payload = FlatBufferSerializer.serializeTrade(data as any);
    }

    const header = Buffer.alloc(HEADER_SIZE);
    const magic = type === 'trade' ? MAGIC_BYTES.TRADE : MAGIC_BYTES.CANDLE;
    magic.copy(header, 0);
    header.writeUInt32LE(payload.length, 4);

    return Buffer.concat([header, payload]);
  }

  /**
   * Convert candle to FootprintCandleData for serialization
   * Handles both BinaryCandle format (symbol, exchange) and FootprintCandleData format (s, ex)
   */
  private static binaryToCandleData(bc: unknown): any {
    const candle = bc as {
      // FootprintCandleData format
      s?: string;
      ex?: string;
      i?: string;
      t?: number;
      ct?: number;
      o?: number;
      h?: number;
      l?: number;
      c?: number;
      v?: number;
      bv?: number;
      sv?: number;
      q?: number;
      bq?: number;
      sq?: number;
      n?: number;
      d?: number;
      dMax?: number;
      dMin?: number;
      tv?: number;
      f?: number;
      ls?: number;
      x?: boolean;
      e?: string;
      tz?: string;
      a?: string;
      s1?: string;
      s2?: string;
      aggs?: Array<{
        tp?: number;
        v?: number;
        bv?: number;
        sv?: number;
        bq?: number;
        sq?: number;
        price?: number;
        buyVolume?: number;
        sellVolume?: number;
        buyQuote?: number;
        sellQuote?: number;
      }>;
      // BinaryCandle format
      symbol?: string;
      exchange?: string;
      timeframe?: string;
      openTime?: number;
      closeTime?: number;
      open?: number;
      high?: number;
      low?: number;
      close?: number;
      volume?: number;
      buyVolume?: number;
      sellVolume?: number;
      quoteVolume?: number;
      buyQuoteVolume?: number;
      sellQuoteVolume?: number;
      tradeCount?: number;
      delta?: number;
      deltaMax?: number;
      deltaMin?: number;
      tickValue?: number;
      firstTradeId?: number;
      lastTradeId?: number;
      isComplete?: boolean;
    };

    // Handle both formats - prefer FootprintCandleData format (s, ex) over BinaryCandle format (symbol, exchange)
    const c = candle as any;

    // Only include id if it's a number (FlatBuffer expects number, not string)
    const numericId = typeof c.id === 'number' ? c.id : undefined;

    return {
      e: c.e,
      tz: c.tz,
      a: c.a,
      s1: c.s1,
      s2: c.s2,
      id: numericId,
      vi: c.vi,
      df: c.df,
      s: c.s ?? c.symbol,
      ex: c.ex ?? c.exchange,
      i: c.i ?? c.timeframe,
      t: c.t ?? c.openTime,
      ct: c.ct ?? c.closeTime,
      o: c.o ?? c.open,
      h: c.h ?? c.high,
      l: c.l ?? c.low,
      c: c.c ?? c.close,
      v: c.v ?? c.volume,
      bv: c.bv ?? c.buyVolume,
      sv: c.sv ?? c.sellVolume,
      q: c.q ?? c.quoteVolume,
      bq: c.bq ?? c.buyQuoteVolume,
      sq: c.sq ?? c.sellQuoteVolume,
      n: c.n ?? c.tradeCount,
      d: c.d ?? c.delta,
      dMax: c.dMax ?? c.deltaMax,
      dMin: c.dMin ?? c.deltaMin,
      tv: c.tv ?? c.tickValue,
      f: c.f ?? c.firstTradeId,
      ls: c.ls ?? c.lastTradeId,
      x: c.x ?? c.isComplete,
      aggs: c.aggs?.map((a: any) => ({
        tp: a.tp ?? a.price ?? 0,
        v: a.v ?? (a.buyVolume || 0) + (a.sellVolume || 0),
        bv: a.bv ?? a.buyVolume ?? 0,
        sv: a.sv ?? a.sellVolume ?? 0,
        bq: a.bq ?? a.buyQuote ?? 0,
        sq: a.sq ?? a.sellQuote ?? 0,
      })),
    };
  }

  static deserialize<T>(buffer: Buffer, type: 'trade' | 'candle'): T {
    if (buffer.length < HEADER_SIZE) {
      throw new Error('Invalid binary file: too short');
    }

    const magic = buffer.subarray(0, 4);
    const length = buffer.readUInt32LE(4);

    const expectedMagic =
      type === 'trade' ? MAGIC_BYTES.TRADE : MAGIC_BYTES.CANDLE;

    if (!magic.equals(expectedMagic)) {
      throw new Error(`Invalid magic bytes for ${type}`);
    }

    const payload = buffer.subarray(HEADER_SIZE, HEADER_SIZE + length);

    if (type === 'candle') {
      // Deserialize batch - returns FootprintCandleData[]
      const candles = FlatBufferSerializer.deserializeCandleBatch(payload);

      // If only one candle, return it directly (for backward compatibility with single candle tests)
      if (candles.length === 1) {
        return candles[0] as T;
      }

      // Extract metadata from first candle for CandleFile structure
      const firstCandle = candles[0];
      const symbol = firstCandle?.s;
      const exchange = firstCandle?.ex;
      const timeframe = firstCandle?.i;

      // Multiple candles - return CandleFile structure
      return {
        version: 1,
        symbol,
        exchange,
        timeframe,
        createdAt: Date.now(),
        blocks: [
          {
            symbol,
            exchange,
            timeframe,
            startTime: firstCandle?.t,
            endTime: candles[candles.length - 1]?.t,
            candles: candles,
          },
        ],
      } as T;
    }

    return FlatBufferSerializer.deserializeTrade(payload) as T;
  }

  static getExtension(type: 'trade' | 'candle'): string {
    return type === 'trade' ? '.fttr' : '.ftcd';
  }
}
