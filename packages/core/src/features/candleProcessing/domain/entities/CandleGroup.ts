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
    public readonly tickValue: number,
    public readonly binMultiplier: number = 1
  ) {
    this.candles = new Map();
  }

  /**
   * Get effective bin size for footprint calculation
   * effectiveBinSize = tickValue × binMultiplier
   */
  get effectiveBinSize(): number {
    return this.tickValue * this.binMultiplier;
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
        this.exchange,
        this.binMultiplier
      );
      this.candles.set(key, candle);
    }

    return candle;
  }

  /**
   * Set candle for a specific timeframe
   */
  setCandle(timeframe: Timeframe, candle: FootprintCandle): void {
    this.candles.set(timeframe.name, candle);
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
   * Clone this CandleGroup
   */
  clone(): CandleGroup {
    const cloned = new CandleGroup(
      this.symbol,
      this.exchange,
      this.tickValue,
      this.binMultiplier
    );

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
  static fromJSON(
    dto: CandleGroupDTO,
    tickValue: number,
    binMultiplier: number = 1
  ): CandleGroup {
    const exchange = dto.data[0]?.ex || '';
    const group = new CandleGroup(
      dto.symbol,
      exchange,
      tickValue,
      binMultiplier
    );

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
    tickValue: number,
    binMultiplier: number = 1
  ): CandleGroup {
    const group = new CandleGroup(symbol, exchange, tickValue, binMultiplier);

    // Initialize all timeframes
    for (const timeframe of Timeframe.all()) {
      const candle = FootprintCandle.createEmpty(
        symbol,
        timeframe,
        tickValue,
        exchange,
        binMultiplier
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
