/**
 * FootprintService - Shared service for HTTP and IPC
 *
 * This service provides footprint data operations that can be used
 * by both HTTP controllers and IPC handlers.
 *
 * Historical data is queried from CandleReaderPort (persistence layer).
 * Real-time streaming is handled separately by CandleGateway (WebSocket).
 *
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import type {
  CandleReaderPort,
  FootprintCandleResult,
  CandleAggregation,
} from '@flowtrace/persistence';
import { CANDLE_READER_TOKEN } from '../tokens.js';
import type {
  FootprintResponseDto,
  FootprintListResponseDto,
} from '../presentation/dto/index.js';
import type { ValidTimeframe } from '../presentation/dto/index.js';

/**
 * Filter options for getting footprints
 */
export interface FootprintFilter {
  timeframe: ValidTimeframe;
  startTime?: number;
  endTime?: number;
}

/**
 * Request params for getting candle detail with footprint
 */
export interface GetCandleDetailParams {
  exchange: string;
  symbol: string;
  timeframe: string;
  openTime: number;
}

/**
 * Request params for getting completed candles with pagination
 */
export interface GetCompletedCandlesParams {
  exchange: string;
  symbol: string;
  timeframe: string;
  page?: number;
  pageSize?: number;
  startTime?: number;
  endTime?: number;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Price level in footprint
 */
export interface PriceLevel {
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
}

/**
 * Completed candle record
 */
export interface CompletedCandle {
  id: string;
  exchange: string;
  symbol: string;
  timeframe: string;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  tradeCount: number;
}

/**
 * Paginated response for completed candles
 */
export interface PaginatedCompletedCandlesResponse {
  candles: CompletedCandle[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

/**
 * Candle detail with footprint data
 */
export interface CandleDetailResponse {
  id: string;
  exchange: string;
  symbol: string;
  timeframe: string;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  tradeCount: number;
  priceLevels: PriceLevel[];
}

/**
 * Transform FootprintCandleResult to CompletedCandle
 */
function toCompletedCandle(candle: FootprintCandleResult): CompletedCandle {
  return {
    id: `${candle.ex}_${candle.s}_${candle.i}_${candle.t}`,
    exchange: candle.ex,
    symbol: candle.s,
    timeframe: candle.i,
    openTime: candle.t,
    closeTime: candle.ct,
    open: candle.o,
    high: candle.h,
    low: candle.l,
    close: candle.c,
    volume: candle.v,
    buyVolume: candle.bv,
    sellVolume: candle.sv,
    delta: candle.d,
    tradeCount: candle.n,
  };
}

/**
 * Transform CandleAggregation to PriceLevel
 */
function toPriceLevel(agg: CandleAggregation): PriceLevel {
  return {
    price: agg.tp,
    volume: agg.v,
    buyVolume: agg.bv,
    sellVolume: agg.sv,
    delta: agg.bv - agg.sv,
  };
}

/**
 * Transform FootprintCandleResult to CandleDetailResponse
 */
function toCandleDetailResponse(
  candle: FootprintCandleResult
): CandleDetailResponse {
  return {
    id: `${candle.ex}_${candle.s}_${candle.i}_${candle.t}`,
    exchange: candle.ex,
    symbol: candle.s,
    timeframe: candle.i,
    openTime: candle.t,
    closeTime: candle.ct,
    open: candle.o,
    high: candle.h,
    low: candle.l,
    close: candle.c,
    volume: candle.v,
    buyVolume: candle.bv,
    sellVolume: candle.sv,
    delta: candle.d,
    tradeCount: candle.n,
    priceLevels: candle.aggs?.map(toPriceLevel) ?? [],
  };
}

/**
 * Transform FootprintCandleResult to FootprintResponseDto
 */
function toFootprintResponseDto(
  candle: FootprintCandleResult
): FootprintResponseDto {
  return {
    symbol: candle.s,
    timeframe: candle.i,
    openTime: candle.t,
    closeTime: candle.ct,
    open: candle.o,
    high: candle.h,
    low: candle.l,
    close: candle.c,
    volume: candle.v,
    buyVolume: candle.bv,
    sellVolume: candle.sv,
    delta: candle.d,
    clusters:
      candle.aggs?.map((agg: CandleAggregation) => ({
        price: agg.tp,
        bidVolume: agg.bv,
        askVolume: agg.sv,
        delta: agg.bv - agg.sv,
        totalVolume: agg.v,
      })) ?? [],
  };
}

@Injectable()
export class FootprintService {
  constructor(
    @Inject(CANDLE_READER_TOKEN)
    @Optional()
    private readonly candleReader: CandleReaderPort | null
  ) {
    console.log(
      '[FootprintService] Initialized with candleReader:',
      this.candleReader ? 'available' : 'null'
    );
  }

  /**
   * Get footprints for a symbol and timeframe
   * Uses CandleReaderPort for historical data access
   */
  async getFootprints(
    symbol: string,
    filter: FootprintFilter
  ): Promise<FootprintListResponseDto> {
    const { timeframe, startTime, endTime } = filter;

    if (!this.candleReader) {
      return {
        symbol,
        timeframe,
        footprints: [],
        count: 0,
      };
    }

    // Default exchange to 'binance' for backward compatibility
    const exchange = 'binance';

    const candles = await this.candleReader.findBySymbol(
      symbol,
      exchange,
      timeframe,
      { startTime, endTime }
    );

    const footprints = candles.map(toFootprintResponseDto);

    return {
      symbol,
      timeframe,
      footprints,
      count: footprints.length,
    };
  }

  /**
   * Get a single footprint for a specific candle time
   */
  async getSingleFootprint(
    symbol: string,
    timeframe: ValidTimeframe,
    time: number
  ): Promise<FootprintResponseDto | null> {
    if (!this.candleReader) {
      return null;
    }

    // Default exchange to 'binance' for backward compatibility
    const exchange = 'binance';

    const candles = await this.candleReader.findBySymbol(
      symbol,
      exchange,
      timeframe,
      { startTime: time, endTime: time, limit: 1 }
    );

    if (candles.length === 0) {
      return null;
    }

    return toFootprintResponseDto(candles[0]);
  }

  /**
   * Get completed candles from persistence with pagination
   */
  async getCompletedCandles(
    params: GetCompletedCandlesParams
  ): Promise<PaginatedCompletedCandlesResponse> {
    const {
      exchange,
      symbol,
      timeframe,
      page = 0, // UI uses 0-based pagination
      pageSize = 25,
      startTime,
      endTime,
      sortOrder = 'desc',
    } = params;

    console.log('[FootprintService] getCompletedCandles called:', {
      exchange,
      symbol,
      timeframe,
      page,
      pageSize,
      startTime,
      endTime,
      hasCandleReader: !!this.candleReader,
    });

    // Graceful degradation when persistence is not available
    if (!this.candleReader) {
      console.log(
        '[FootprintService] No candleReader available, returning empty'
      );
      return {
        candles: [],
        pagination: { page, pageSize, totalCount: 0, totalPages: 0 },
      };
    }

    // Get total count for pagination
    const totalCount = await this.candleReader.count(
      symbol,
      exchange,
      timeframe,
      { startTime, endTime }
    );
    console.log('[FootprintService] totalCount:', totalCount);

    const totalPages = Math.ceil(totalCount / pageSize);

    // Query candles with limit for pagination
    // Note: For proper pagination, we'd need offset support in CandleReaderPort
    // For now, we fetch more and slice (not ideal for large datasets)
    const candles = await this.candleReader.findBySymbol(
      symbol,
      exchange,
      timeframe,
      { startTime, endTime }
    );
    console.log('[FootprintService] candles found:', candles.length);

    // Transform to CompletedCandle
    const completedCandles = candles.map(toCompletedCandle);

    // Apply sorting
    completedCandles.sort((a: CompletedCandle, b: CompletedCandle) => {
      const comparison = a.openTime - b.openTime;
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Apply pagination (0-based page index)
    const startIndex = page * pageSize;
    const paginatedCandles = completedCandles.slice(
      startIndex,
      startIndex + pageSize
    );

    console.log('[FootprintService] pagination:', {
      startIndex,
      paginatedCount: paginatedCandles.length,
    });

    return {
      candles: paginatedCandles,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
    };
  }

  /**
   * Get candle detail with footprint data
   */
  async getCandleDetail(
    params: GetCandleDetailParams
  ): Promise<CandleDetailResponse | null> {
    const { exchange, symbol, timeframe, openTime } = params;

    // Graceful degradation when persistence is not available
    if (!this.candleReader) {
      return null;
    }

    const candles = await this.candleReader.findBySymbol(
      symbol,
      exchange,
      timeframe,
      { startTime: openTime, endTime: openTime, limit: 1 }
    );

    if (candles.length === 0) {
      return null;
    }

    return toCandleDetailResponse(candles[0]);
  }
}
