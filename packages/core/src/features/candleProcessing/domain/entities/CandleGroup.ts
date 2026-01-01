/**
 * CandleGroup Entity
 *
 * Represents a group of candles for a symbol across all timeframes.
 * Manages multi-timeframe candle data for a single symbol.
 *
 */

import { Timeframe } from '../value-objects/Timeframe.js';
import { FootprintCandle, FootprintCandleDTO } from './FootprintCandle.js';

/**
 * CandleGroup DTO for serialization
 */
export interface CandleGroupDTO {
  event: string;
  typeData: string;
  eventTime: number;
  asset: string;
  symbol: string;
  contSymbol: string;
  data: FootprintCandleDTO[];
}

/**
 * CandleGroup entity
 * Manages candles across all timeframes for a symbol
 */
export class CandleGroup {
  private candles: Map<string, FootprintCandle>;

  constructor(
    public readonly symbol: string,
    public readonly exchange: string,
    public readonly tickValue: number
  ) {
    this.candles = new Map();
  }

  /**
   * Get the 1-second candle (base candle for trade processing)
   */
  getOneSecondCandle(): FootprintCandle {
    return this.getCandle(Timeframe.oneSecond());
  }

  /**
   * Get candle for a specific timeframe
   */
  getCandle(timeframe: Timeframe): FootprintCandle {
    const key = timeframe.name;
    let candle = this.candles.get(key);

    if (!candle) {
      candle = FootprintCandle.createEmpty(
        this.symbol,
        timeframe,
        this.tickValue,
        this.exchange
      );
      this.candles.set(key, candle);
    }

    return candle;
  }

  /**
   * Get candle by timeframe name
   */
  getCandleByName(timeframeName: string): FootprintCandle | undefined {
    return this.candles.get(timeframeName);
  }

  /**
   * Set candle for a specific timeframe
   */
  setCandle(timeframe: Timeframe, candle: FootprintCandle): void {
    this.candles.set(timeframe.name, candle);
  }

  /**
   * Set candle by timeframe name
   */
  setCandleByName(timeframeName: string, candle: FootprintCandle): void {
    this.candles.set(timeframeName, candle);
  }

  /**
   * Get all timeframes that have candles
   */
  getAllTimeframes(): Timeframe[] {
    return Array.from(this.candles.keys())
      .filter((name) => Timeframe.isValid(name))
      .map((name) => new Timeframe(name));
  }

  /**
   * Get all candles as array (ordered by timeframe)
   */
  getAllCandles(): FootprintCandle[] {
    const timeframeOrder = Timeframe.allNames();
    return timeframeOrder
      .filter((name) => this.candles.has(name))
      .map((name) => this.candles.get(name)!);
  }

  /**
   * Reset candle for a timeframe using data from another candle
   */
  resetCandle(timeframe: Timeframe, fromCandle: FootprintCandle): void {
    const newCandle = FootprintCandle.createEmpty(
      this.symbol,
      timeframe,
      this.tickValue,
      this.exchange
    );

    // Initialize with the source candle's data
    newCandle.t = fromCandle.t;
    newCandle.o = fromCandle.o;
    newCandle.h = fromCandle.h;
    newCandle.l = fromCandle.l;
    newCandle.c = fromCandle.c;
    newCandle.v = fromCandle.v;
    newCandle.bv = fromCandle.bv;
    newCandle.sv = fromCandle.sv;
    newCandle.q = fromCandle.q;
    newCandle.bq = fromCandle.bq;
    newCandle.sq = fromCandle.sq;
    newCandle.n = fromCandle.n;
    newCandle.d = fromCandle.d;
    newCandle.dMax = fromCandle.dMax;
    newCandle.dMin = fromCandle.dMin;
    newCandle.f = fromCandle.f;
    newCandle.ls = fromCandle.ls;
    newCandle.aggs = JSON.parse(JSON.stringify(fromCandle.aggs));

    this.candles.set(timeframe.name, newCandle);
  }

  /**
   * Clone this CandleGroup
   */
  clone(): CandleGroup {
    const cloned = new CandleGroup(this.symbol, this.exchange, this.tickValue);

    for (const [key, candle] of this.candles) {
      cloned.candles.set(key, candle.clone());
    }

    return cloned;
  }

  /**
   * Convert to DTO for serialization
   */
  toJSON(): CandleGroupDTO {
    const timeframeOrder = Timeframe.allNames();
    const data = timeframeOrder
      .filter((name) => this.candles.has(name))
      .map((name) => this.candles.get(name)!.toJSON());

    return {
      event: 'CANDLESTICK',
      typeData: 'RT',
      eventTime: Date.now(),
      asset: '',
      symbol: this.symbol,
      contSymbol: '',
      data,
    };
  }

  /**
   * Create CandleGroup from DTO
   */
  static fromJSON(dto: CandleGroupDTO, tickValue: number): CandleGroup {
    const exchange = dto.data[0]?.ex || '';
    const group = new CandleGroup(dto.symbol, exchange, tickValue);

    for (const candleDTO of dto.data) {
      const candle = FootprintCandle.fromJSON(candleDTO);
      group.candles.set(candleDTO.i, candle);
    }

    return group;
  }

  /**
   * Create default CandleGroup with all timeframes initialized
   */
  static createDefault(
    symbol: string,
    exchange: string,
    tickValue: number
  ): CandleGroup {
    const group = new CandleGroup(symbol, exchange, tickValue);

    // Initialize all timeframes
    for (const timeframe of Timeframe.all()) {
      const candle = FootprintCandle.createEmpty(
        symbol,
        timeframe,
        tickValue,
        exchange
      );
      group.candles.set(timeframe.name, candle);
    }

    return group;
  }

  /**
   * Get number of candles in this group
   */
  get size(): number {
    return this.candles.size;
  }

  /**
   * Check if group has a candle for a timeframe
   */
  hasCandle(timeframe: Timeframe): boolean {
    return this.candles.has(timeframe.name);
  }
}
