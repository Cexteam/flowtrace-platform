/**
 * FootprintCandle Entity
 *
 * Represents a candle with footprint (volume profile) data.
 * Contains OHLCV data plus price-level volume breakdown.
 *
 */

import _ from 'lodash';
import { Timeframe } from '../value-objects/Timeframe.js';
import { TradeData, RawTrade, isBuyTrade } from '../value-objects/TradeData.js';
import { Aggs, mergeAggsArrays } from './PriceBin.js';
import { CalAggsFootprint } from '../services/FootprintCalculator.js';

/**
 * FootprintCandle DTO for serialization
 */
export interface FootprintCandleDTO {
  e: string; // Event type
  tz: string; // Timezone
  ex: string; // Exchange
  a: string; // Asset
  s: string; // Symbol
  i: string; // Interval (timeframe)
  vi: number; // Interval in seconds
  t: number; // Open time
  o: number; // Open price
  h: number; // High price
  l: number; // Low price
  c: number; // Close price
  ct: number; // Close time
  v: number; // Volume
  bv: number; // Buy volume
  sv: number; // Sell volume
  q: number; // Quote volume
  bq: number; // Buy quote volume
  sq: number; // Sell quote volume
  n: number; // Number of trades
  d: number; // Delta
  dMax: number; // Max delta
  dMin: number; // Min delta
  tv: number; // Tick value
  aggs: Aggs[]; // Price bins
  f: number; // First trade ID
  ls: number; // Last trade ID
  x: boolean; // Is complete
}

/**
 * FootprintCandle entity
 * Represents a candle with volume profile data
 */
export class FootprintCandle {
  // Event metadata
  public e: string = 'CANDLESTICK';
  public tz: string = 'UTC';
  public ex: string = '';
  public a: string = '';

  // Symbol and timeframe
  public s: string;
  public i: string;
  public vi: number;

  // OHLCV data
  public t: number = 0; // Open time
  public o: number = 0; // Open
  public h: number = 0; // High
  public l: number = 0; // Low
  public c: number = 0; // Close
  public ct: number = 0; // Close time
  public v: number = 0; // Volume
  public bv: number = 0; // Buy volume
  public sv: number = 0; // Sell volume

  // Quote volumes
  public q: number = 0; // Total quote volume
  public bq: number = 0; // Buy quote volume
  public sq: number = 0; // Sell quote volume

  // Trade stats
  public n: number = 0; // Number of trades
  public f: number = 0; // First trade ID
  public ls: number = 0; // Last trade ID

  // Delta tracking
  public d: number = 0; // Current delta
  public dMax: number = 0; // Max delta
  public dMin: number = 0; // Min delta

  // Footprint data
  public tv: number; // Tick value for binning
  public aggs: Aggs[] = []; // Price bins

  // Completion status
  public x: boolean = false;

  constructor(
    symbol: string,
    timeframe: Timeframe,
    tickValue: number,
    exchange: string = ''
  ) {
    this.s = symbol;
    this.i = timeframe.name;
    this.vi = timeframe.seconds;
    this.tv = tickValue;
    this.ex = exchange;
  }

  /**
   * Apply a trade to this candle
   * Updates OHLCV and footprint data
   *
   * Matches exact update logic from original cm_sync_candle:
   * - h = max(current h, trade price)
   * - l = min(current l, trade price)
   * - c = trade price
   * - v = v + quantity (toFixed(8))
   * - bv = bv + quantity if buy (toFixed(8))
   * - sv = sv + quantity if sell (toFixed(8))
   * - d = parseFloat((bv - sv).toFixed(8))
   * - q = q + (price * quantity) (toFixed(8))
   * - bq = bq + (price * quantity) if buy (toFixed(8))
   * - sq = sq + (price * quantity) if sell (toFixed(8))
   * - dMax = max(dMax, d)
   * - dMin = min(dMin, d)
   * - n++
   * - ls = trade id
   * - aggs = CalAggsFootprint(aggs, trade, tickValue)
   *
   */
  applyTrade(trade: TradeData, tickValue: number): void {
    const price = trade.price;
    const quantity = trade.quantity;
    const quoteVolume = price * quantity;
    const isBuy = isBuyTrade(trade);

    // Initialize candle on first trade
    // Align timestamp to period start (matching repo gốc: opentime = floor(T) - floor(T % periodMs))
    if (this.t === 0) {
      const periodMs = this.vi * 1000; // vi = interval in seconds
      this.t = Math.floor(trade.timestamp / periodMs) * periodMs; // Aligned to period start
      this.o = price;
      this.h = price;
      this.l = price;
    }

    // Update OHLC - exact match to original
    this.h = price > this.h ? price : this.h;
    this.l = price < this.l ? price : this.l;
    this.c = price;

    // Update volumes with toFixed(8) precision - exact match to original
    this.v = parseFloat((this.v + quantity).toFixed(8));
    this.bv = isBuy ? parseFloat((this.bv + quantity).toFixed(8)) : this.bv;
    this.sv = !isBuy ? parseFloat((this.sv + quantity).toFixed(8)) : this.sv;

    // Update quote volumes with toFixed(8) precision - exact match to original
    this.q = parseFloat((this.q + quoteVolume).toFixed(8));
    this.bq = isBuy ? parseFloat((this.bq + quoteVolume).toFixed(8)) : this.bq;
    this.sq = !isBuy ? parseFloat((this.sq + quoteVolume).toFixed(8)) : this.sq;

    // Update trade count
    this.n++;

    // Update trade IDs
    if (trade.tradeId !== undefined) {
      if (this.f === 0) this.f = trade.tradeId;
      this.ls = trade.tradeId;
    }

    // Update delta with toFixed(8) precision - exact match to original
    const delta = parseFloat((this.bv - this.sv).toFixed(8));
    this.d = delta;
    this.dMax = delta > this.dMax ? delta : this.dMax;
    this.dMin = delta < this.dMin ? delta : this.dMin;

    // Update footprint bins using CalAggsFootprint - exact match to original
    const rawTrade: RawTrade = {
      p: price.toString(),
      q: quantity.toString(),
      m: trade.isBuyerMaker, // true = sell, false = buy
      T: trade.timestamp,
      s: trade.symbol,
      t: trade.tradeId,
    };
    this.aggs = CalAggsFootprint(this.aggs, rawTrade, tickValue);
  }

  /**
   * Mark candle as complete
   */
  markComplete(completionTime: number): void {
    this.x = true;
    this.ct = completionTime;
  }

  /**
   * Merge another candle into this one
   * Used for timeframe rollup
   */
  merge(other: FootprintCandle): void {
    // Update OHLC
    if (this.t === 0 || other.t < this.t) {
      this.o = other.o;
      this.t = other.t;
    }
    this.h = Math.max(this.h || 0, other.h || 0);
    this.l = this.l === 0 ? other.l : Math.min(this.l, other.l || Infinity);
    this.c = other.c;

    // Update volumes
    this.v = parseFloat((this.v + other.v).toFixed(8));
    this.bv = parseFloat((this.bv + other.bv).toFixed(8));
    this.sv = parseFloat((this.sv + other.sv).toFixed(8));
    this.q = parseFloat((this.q + other.q).toFixed(5));
    this.bq = parseFloat((this.bq + other.bq).toFixed(8));
    this.sq = parseFloat((this.sq + other.sq).toFixed(8));

    // Update trade stats
    this.n += other.n;
    this.ls = other.ls;

    // Update delta
    this.d = parseFloat((this.bv - this.sv).toFixed(8));
    this.dMax = Math.max(this.dMax || 0, this.d);
    this.dMin = Math.min(this.dMin || 0, this.d);

    // Merge footprint bins
    this.aggs = mergeAggsArrays(this.aggs, other.aggs);
  }

  /**
   * Initialize a new candle at a specific time
   */
  initializeNewCandle(startTime: number, price: number): void {
    this.t = startTime;
    this.o = price;
    this.h = price;
    this.l = price;
    this.c = price;
    this.v = 0;
    this.bv = 0;
    this.sv = 0;
    this.q = 0;
    this.bq = 0;
    this.sq = 0;
    this.n = 0;
    this.d = 0;
    this.dMax = 0;
    this.dMin = 0;
    this.f = 0;
    this.ls = 0;
    this.x = false;
    this.ct = 0;
    this.aggs = [];
  }

  /**
   * Clone this candle
   * Uses lodash cloneDeep for deep copying to match production logic
   *
   */
  clone(): FootprintCandle {
    const cloned = new FootprintCandle(
      this.s,
      new Timeframe(this.i),
      this.tv,
      this.ex
    );
    cloned.e = this.e;
    cloned.tz = this.tz;
    cloned.a = this.a;
    cloned.t = this.t;
    cloned.o = this.o;
    cloned.h = this.h;
    cloned.l = this.l;
    cloned.c = this.c;
    cloned.ct = this.ct;
    cloned.v = this.v;
    cloned.bv = this.bv;
    cloned.sv = this.sv;
    cloned.q = this.q;
    cloned.bq = this.bq;
    cloned.sq = this.sq;
    cloned.n = this.n;
    cloned.f = this.f;
    cloned.ls = this.ls;
    cloned.d = this.d;
    cloned.dMax = this.dMax;
    cloned.dMin = this.dMin;
    cloned.x = this.x;
    cloned.aggs = _.cloneDeep(this.aggs);
    return cloned;
  }

  /**
   * Convert to DTO for serialization
   */
  toJSON(): FootprintCandleDTO {
    return {
      e: this.e,
      tz: this.tz,
      ex: this.ex,
      a: this.a,
      s: this.s,
      i: this.i,
      vi: this.vi,
      t: this.t,
      o: this.o,
      h: this.h,
      l: this.l,
      c: this.c,
      ct: this.ct,
      v: this.v,
      bv: this.bv,
      sv: this.sv,
      q: this.q,
      bq: this.bq,
      sq: this.sq,
      n: this.n,
      d: this.d,
      dMax: this.dMax,
      dMin: this.dMin,
      tv: this.tv,
      aggs: this.aggs,
      f: this.f,
      ls: this.ls,
      x: this.x,
    };
  }

  /**
   * Create FootprintCandle from DTO
   */
  static fromJSON(dto: FootprintCandleDTO): FootprintCandle {
    const candle = new FootprintCandle(
      dto.s,
      new Timeframe(dto.i),
      dto.tv,
      dto.ex
    );
    candle.e = dto.e;
    candle.tz = dto.tz;
    candle.a = dto.a;
    candle.t = dto.t;
    candle.o = dto.o;
    candle.h = dto.h;
    candle.l = dto.l;
    candle.c = dto.c;
    candle.ct = dto.ct;
    candle.v = dto.v;
    candle.bv = dto.bv;
    candle.sv = dto.sv;
    candle.q = dto.q;
    candle.bq = dto.bq;
    candle.sq = dto.sq;
    candle.n = dto.n;
    candle.f = dto.f;
    candle.ls = dto.ls;
    candle.d = dto.d;
    candle.dMax = dto.dMax;
    candle.dMin = dto.dMin;
    candle.x = dto.x;
    candle.aggs = dto.aggs;
    return candle;
  }

  /**
   * Create an empty candle for a symbol/timeframe
   */
  static createEmpty(
    symbol: string,
    timeframe: Timeframe,
    tickValue: number,
    exchange: string = ''
  ): FootprintCandle {
    return new FootprintCandle(symbol, timeframe, tickValue, exchange);
  }
}
