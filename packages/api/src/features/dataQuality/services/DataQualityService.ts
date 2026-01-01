/**
 * DataQualityService - Shared service for HTTP and IPC
 *
 * This service provides data quality operations that can be used
 * by both HTTP controllers and IPC handlers.
 *
 * Uses GapReaderPort from @flowtrace/persistence for read-only gap access.
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import type { GapReaderPort, GapRecord } from '@flowtrace/persistence';
import type {
  GapCheckResponseDto,
  DataGapDto,
} from '../presentation/dto/index.js';

export const GAP_READER_TOKEN = Symbol('GapReaderPort');

export interface GapCheckParams {
  fromTime: number;
  toTime: number;
}

export interface TradeGapCheckParams {
  symbol: string;
  exchange: string;
  from?: string;
  to?: string;
}

export interface TradeGapResponseDto {
  symbol: string;
  exchange: string;
  fromTime: string;
  toTime: string;
  gaps: Array<{
    from: number;
    to: number;
    duration: number;
    durationHuman: string;
  }>;
  totalGaps: number;
  totalMissingDuration: number;
  dataCompleteness: number;
  checkedAt: string;
}

/**
 * Gap record for UI display - aggregated by symbol
 */
export interface GapRecordDto {
  id: string;
  symbol: string;
  exchange: string;
  gapCount: number;
  firstGapTime: number;
  lastGapTime: number;
  totalMissingTrades: number;
  severity: 'critical' | 'warning' | 'info';
}

/**
 * Filter options for getting gaps by exchange
 */
export interface GetGapsByExchangeParams {
  exchange: string;
  page?: number;
  pageSize?: number;
  search?: string;
  severity?: 'all' | 'critical' | 'warning' | 'info';
  sortBy?: 'gapCount' | 'totalMissingTrades' | 'lastGapTime' | 'symbol';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response for gaps
 */
export interface PaginatedGapsResponse {
  gaps: GapRecordDto[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  stats: {
    totalGaps: number;
    totalMissingTrades: number;
    symbolsAffected: number;
  };
}

/**
 * Determine severity based on total missing trades
 */
function getSeverity(
  totalMissingTrades: number
): 'critical' | 'warning' | 'info' {
  if (totalMissingTrades > 1000) return 'critical';
  if (totalMissingTrades > 100) return 'warning';
  return 'info';
}

/**
 * Format duration in human readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  if (ms < 86400000) return `${(ms / 3600000).toFixed(1)}h`;
  return `${(ms / 86400000).toFixed(1)}d`;
}

/**
 * Aggregate gap records by symbol
 */
function aggregateGapsBySymbol(
  gaps: GapRecord[],
  exchange: string
): GapRecordDto[] {
  const symbolMap = new Map<
    string,
    {
      gapCount: number;
      firstGapTime: number;
      lastGapTime: number;
      totalMissingTrades: number;
    }
  >();

  for (const gap of gaps) {
    const existing = symbolMap.get(gap.symbol);
    if (existing) {
      existing.gapCount += 1;
      existing.firstGapTime = Math.min(existing.firstGapTime, gap.detectedAt);
      existing.lastGapTime = Math.max(existing.lastGapTime, gap.detectedAt);
      existing.totalMissingTrades += gap.gapSize;
    } else {
      symbolMap.set(gap.symbol, {
        gapCount: 1,
        firstGapTime: gap.detectedAt,
        lastGapTime: gap.detectedAt,
        totalMissingTrades: gap.gapSize,
      });
    }
  }

  const result: GapRecordDto[] = [];
  for (const [symbol, data] of symbolMap) {
    result.push({
      id: `${exchange}-${symbol}`,
      symbol,
      exchange,
      gapCount: data.gapCount,
      firstGapTime: data.firstGapTime,
      lastGapTime: data.lastGapTime,
      totalMissingTrades: data.totalMissingTrades,
      severity: getSeverity(data.totalMissingTrades),
    });
  }

  return result;
}

@Injectable()
export class DataQualityService {
  constructor(
    @Inject(GAP_READER_TOKEN)
    @Optional()
    private readonly gapReader: GapReaderPort | null
  ) {
    console.log(
      '[DataQualityService] Initialized with gapReader:',
      this.gapReader ? 'available' : 'null'
    );
  }

  /**
   * Check for data gaps in the specified time range
   */
  async checkGaps(params: GapCheckParams): Promise<GapCheckResponseDto> {
    console.log('[DataQualityService] checkGaps called:', params);
    const { fromTime, toTime } = params;

    if (!this.gapReader) {
      return {
        gaps: [],
        totalGaps: 0,
        totalMissingDuration: 0,
        dataCompleteness: 100,
        checkedRange: {
          from: fromTime,
          to: toTime,
          durationMs: toTime - fromTime,
        },
      };
    }

    try {
      const { gaps, totalCount } = await this.gapReader.loadGaps();

      // Filter gaps within time range
      const filteredGaps = gaps.filter(
        (g) => g.detectedAt >= fromTime && g.detectedAt <= toTime
      );

      const totalMissingTrades = filteredGaps.reduce(
        (sum, g) => sum + g.gapSize,
        0
      );

      // Estimate data completeness (rough approximation)
      const durationMs = toTime - fromTime;
      const estimatedTotalTrades = durationMs / 100; // Assume ~10 trades/sec
      const dataCompleteness =
        estimatedTotalTrades > 0
          ? Math.max(
              0,
              ((estimatedTotalTrades - totalMissingTrades) /
                estimatedTotalTrades) *
                100
            )
          : 100;

      return {
        gaps: filteredGaps.map((g) => ({
          from: g.fromTradeId,
          to: g.toTradeId,
          durationMs: g.gapSize, // gapSize represents missing trades count
        })),
        totalGaps: filteredGaps.length,
        totalMissingDuration: totalMissingTrades,
        dataCompleteness: Math.round(dataCompleteness * 100) / 100,
        checkedRange: {
          from: fromTime,
          to: toTime,
          durationMs,
        },
      };
    } catch (error) {
      console.error('[DataQualityService] checkGaps error:', error);
      return {
        gaps: [],
        totalGaps: 0,
        totalMissingDuration: 0,
        dataCompleteness: 100,
        checkedRange: {
          from: fromTime,
          to: toTime,
          durationMs: toTime - fromTime,
        },
      };
    }
  }

  /**
   * Check for trade gaps for a specific symbol and exchange
   */
  async checkTradeGaps(
    params: TradeGapCheckParams
  ): Promise<TradeGapResponseDto> {
    const { symbol, exchange, from, to } = params;

    const fromTime = from
      ? new Date(from)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const toTime = to ? new Date(to) : new Date();

    if (fromTime >= toTime) {
      throw new Error('From time must be before to time');
    }

    if (!this.gapReader) {
      return {
        symbol,
        exchange,
        fromTime: fromTime.toISOString(),
        toTime: toTime.toISOString(),
        gaps: [],
        totalGaps: 0,
        totalMissingDuration: 0,
        dataCompleteness: 100,
        checkedAt: new Date().toISOString(),
      };
    }

    try {
      const { gaps } = await this.gapReader.loadGaps({ symbol });

      // Filter by time range
      const filteredGaps = gaps.filter(
        (g) =>
          g.detectedAt >= fromTime.getTime() && g.detectedAt <= toTime.getTime()
      );

      const totalDuration = toTime.getTime() - fromTime.getTime();
      const totalMissingTrades = filteredGaps.reduce(
        (sum, g) => sum + g.gapSize,
        0
      );

      // Estimate completeness
      const estimatedTotalTrades = totalDuration / 100;
      const dataCompleteness =
        estimatedTotalTrades > 0
          ? Math.max(
              0,
              ((estimatedTotalTrades - totalMissingTrades) /
                estimatedTotalTrades) *
                100
            )
          : 100;

      return {
        symbol,
        exchange,
        fromTime: fromTime.toISOString(),
        toTime: toTime.toISOString(),
        gaps: filteredGaps.map((g) => ({
          from: g.fromTradeId,
          to: g.toTradeId,
          duration: g.gapSize,
          durationHuman: `${g.gapSize} trades`,
        })),
        totalGaps: filteredGaps.length,
        totalMissingDuration: totalMissingTrades,
        dataCompleteness: Math.round(dataCompleteness * 100) / 100,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[DataQualityService] checkTradeGaps error:', error);
      return {
        symbol,
        exchange,
        fromTime: fromTime.toISOString(),
        toTime: toTime.toISOString(),
        gaps: [],
        totalGaps: 0,
        totalMissingDuration: 0,
        dataCompleteness: 100,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Get gaps by exchange with pagination
   * Returns aggregated gap data per symbol
   */
  async getGapsByExchange(
    params: GetGapsByExchangeParams
  ): Promise<PaginatedGapsResponse> {
    console.log('[DataQualityService] getGapsByExchange called:', params);

    const {
      exchange,
      page = 1,
      pageSize = 25,
      search,
      severity,
      sortBy = 'lastGapTime',
      sortOrder = 'desc',
    } = params;

    console.log('[DataQualityService] gapReader available:', !!this.gapReader);

    if (!this.gapReader) {
      console.log('[DataQualityService] No gapReader, returning empty');
      return {
        gaps: [],
        pagination: { page, pageSize, totalCount: 0, totalPages: 0 },
        stats: { totalGaps: 0, totalMissingTrades: 0, symbolsAffected: 0 },
      };
    }

    try {
      // Get gaps from database filtered by exchange
      console.log('[DataQualityService] Loading gaps from database...');
      const { gaps: allGaps } = await this.gapReader.loadGaps({ exchange });
      console.log('[DataQualityService] Loaded gaps:', allGaps.length);

      // Aggregate gaps by symbol
      let gaps = aggregateGapsBySymbol(allGaps, exchange);
      console.log(
        '[DataQualityService] Aggregated gaps by symbol:',
        gaps.length
      );

      // Apply search filter
      if (search && search.trim()) {
        const searchLower = search.toLowerCase().trim();
        gaps = gaps.filter((g) => g.symbol.toLowerCase().includes(searchLower));
      }

      // Apply severity filter
      if (severity && severity !== 'all') {
        gaps = gaps.filter((g) => g.severity === severity);
      }

      // Apply sorting
      gaps.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'gapCount':
            comparison = a.gapCount - b.gapCount;
            break;
          case 'totalMissingTrades':
            comparison = a.totalMissingTrades - b.totalMissingTrades;
            break;
          case 'lastGapTime':
            comparison = a.lastGapTime - b.lastGapTime;
            break;
          case 'symbol':
            comparison = a.symbol.localeCompare(b.symbol);
            break;
          default:
            comparison = a.lastGapTime - b.lastGapTime;
        }
        return sortOrder === 'desc' ? -comparison : comparison;
      });

      // Calculate stats from all gaps (before pagination)
      const stats = {
        totalGaps: allGaps.length,
        totalMissingTrades: allGaps.reduce((sum, g) => sum + g.gapSize, 0),
        symbolsAffected: gaps.length,
      };

      // Apply pagination (page is 0-indexed from UI)
      const totalCount = gaps.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const startIndex = page * pageSize;
      const paginatedGaps = gaps.slice(startIndex, startIndex + pageSize);

      console.log('[DataQualityService] Pagination:', {
        page,
        pageSize,
        totalCount,
        totalPages,
        startIndex,
        paginatedGapsCount: paginatedGaps.length,
      });

      return {
        gaps: paginatedGaps,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
        },
        stats,
      };
    } catch (error) {
      console.error('[DataQualityService] getGapsByExchange error:', error);
      return {
        gaps: [],
        pagination: { page, pageSize, totalCount: 0, totalPages: 0 },
        stats: { totalGaps: 0, totalMissingTrades: 0, symbolsAffected: 0 },
      };
    }
  }
}
