/**
 * FootprintController - API Functions for Footprint/Candles
 *
 * API functions that make HTTP requests (web) or IPC calls (Electron).
 * Automatically detects environment and uses appropriate adapter.
 * Follows the Controller → Hook → Component pattern.
 *
 * Requirements: 13.1, 13.3, 13.4, 14.1, 14.3
 */

import type {
  Candle,
  CandleDetail,
  PriceLevel,
  GetCompletedCandlesRequest,
  GetCompletedCandlesResponse,
  GetCandleDetailRequest,
} from '../../domain/types';

/**
 * Server Action result type
 */
export interface ServerActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Check if running in Electron environment
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && 'electron' in window;
}

/**
 * Get Electron API (type-safe)
 */
function getElectronAPI(): {
  invoke: <T>(channel: string, args?: unknown) => Promise<T>;
} | null {
  if (isElectron()) {
    return (
      window as unknown as {
        electron: {
          invoke: <T>(channel: string, args?: unknown) => Promise<T>;
        };
      }
    ).electron;
  }
  return null;
}

/**
 * Get completed candles with pagination and date range
 *
 * @param request - Request parameters
 * @returns Server action result with paginated candles
 */
export async function getCompletedCandlesAction(
  request: GetCompletedCandlesRequest
): Promise<ServerActionResult<GetCompletedCandlesResponse>> {
  try {
    const electronAPI = getElectronAPI();

    if (electronAPI) {
      // Electron: Use IPC
      const data = await electronAPI.invoke<Record<string, unknown>>(
        'footprint:getCompleted',
        request
      );
      return {
        success: true,
        data: mapCompletedCandlesResponse(data),
      };
    }

    // Web: Use HTTP API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    const params = new URLSearchParams();
    params.append('exchange', request.exchange);
    params.append('symbol', request.symbol);
    params.append('timeframe', request.timeframe);
    if (request.page !== undefined)
      params.append('page', request.page.toString());
    if (request.pageSize !== undefined)
      params.append('pageSize', request.pageSize.toString());
    if (request.startTime !== undefined)
      params.append('startTime', request.startTime.toString());
    if (request.endTime !== undefined)
      params.append('endTime', request.endTime.toString());
    if (request.sortOrder) params.append('sortOrder', request.sortOrder);

    const url = `${apiUrl}/candles/completed?${params.toString()}`;

    const response = await fetch(url, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to get completed candles: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: mapCompletedCandlesResponse(data),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get candle detail with footprint data
 *
 * @param request - Request parameters
 * @returns Server action result with candle detail
 */
export async function getCandleDetailAction(
  request: GetCandleDetailRequest
): Promise<ServerActionResult<CandleDetail>> {
  try {
    const electronAPI = getElectronAPI();

    if (electronAPI) {
      // Electron: Use IPC
      const data = await electronAPI.invoke<Record<string, unknown>>(
        'footprint:getCandleDetail',
        request
      );
      return {
        success: true,
        data: mapCandleDetailResponse(data),
      };
    }

    // Web: Use HTTP API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    const params = new URLSearchParams();
    params.append('exchange', request.exchange);
    params.append('symbol', request.symbol);
    params.append('timeframe', request.timeframe);
    params.append('openTime', request.openTime.toString());

    const url = `${apiUrl}/footprint/detail?${params.toString()}`;

    const response = await fetch(url, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to get candle detail: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: mapCandleDetailResponse(data),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Map API response to GetCompletedCandlesResponse domain type
 */
function mapCompletedCandlesResponse(
  data: Record<string, unknown>
): GetCompletedCandlesResponse {
  const candlesData = (data.candles as Array<Record<string, unknown>>) || [];
  const paginationData = (data.pagination as Record<string, unknown>) || {};

  const candles: Candle[] = candlesData.map((candle) => ({
    id:
      (candle.id as string) ||
      `${candle.exchange}-${candle.symbol}-${candle.openTime}`,
    exchange: candle.exchange as string,
    symbol: candle.symbol as string,
    timeframe: candle.timeframe as string,
    openTime: (candle.openTime as number) || 0,
    closeTime: (candle.closeTime as number) || 0,
    open: (candle.open as number) || 0,
    high: (candle.high as number) || 0,
    low: (candle.low as number) || 0,
    close: (candle.close as number) || 0,
    volume: (candle.volume as number) || 0,
    buyVolume: (candle.buyVolume as number) || 0,
    sellVolume: (candle.sellVolume as number) || 0,
    delta: (candle.delta as number) || 0,
    tradeCount: (candle.tradeCount as number) || 0,
  }));

  return {
    candles,
    pagination: {
      page: (paginationData.page as number) || 0,
      pageSize: (paginationData.pageSize as number) || 25,
      totalCount: (paginationData.totalCount as number) || candles.length,
      totalPages: (paginationData.totalPages as number) || 1,
    },
  };
}

/**
 * Map API response to CandleDetail domain type
 */
function mapCandleDetailResponse(data: Record<string, unknown>): CandleDetail {
  const priceLevelsData =
    (data.priceLevels as Array<Record<string, unknown>>) || [];

  const priceLevels: PriceLevel[] = priceLevelsData.map((level) => ({
    price: (level.price as number) || 0,
    volume: (level.volume as number) || 0,
    buyVolume: (level.buyVolume as number) || 0,
    sellVolume: (level.sellVolume as number) || 0,
    delta: (level.delta as number) || 0,
  }));

  return {
    id:
      (data.id as string) || `${data.exchange}-${data.symbol}-${data.openTime}`,
    exchange: data.exchange as string,
    symbol: data.symbol as string,
    timeframe: data.timeframe as string,
    openTime: (data.openTime as number) || 0,
    closeTime: (data.closeTime as number) || 0,
    open: (data.open as number) || 0,
    high: (data.high as number) || 0,
    low: (data.low as number) || 0,
    close: (data.close as number) || 0,
    volume: (data.volume as number) || 0,
    buyVolume: (data.buyVolume as number) || 0,
    sellVolume: (data.sellVolume as number) || 0,
    delta: (data.delta as number) || 0,
    tradeCount: (data.tradeCount as number) || 0,
    priceLevels,
  };
}
