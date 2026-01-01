/**
 * DataQualityController - API Functions for Data Quality
 *
 * API functions that make HTTP requests (web) or IPC calls (Electron).
 * Automatically detects environment and uses appropriate adapter.
 * Follows the Controller → Hook → Component pattern.
 *
 */

import type {
  CheckTradeGapsRequest,
  CheckTradeGapsResponse,
  TradeGap,
  GetGapsByExchangeRequest,
  GetGapsByExchangeResponse,
  GapRecord,
  GapSeverity,
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
 * Check for trade data gaps
 *
 * @param request - Gap check parameters
 * @returns Server action result with gap check data
 */
export async function checkTradeGapsAction(
  request: CheckTradeGapsRequest
): Promise<ServerActionResult<CheckTradeGapsResponse>> {
  try {
    const electronAPI = getElectronAPI();

    if (electronAPI) {
      // Electron: Use IPC
      const data = await electronAPI.invoke<Record<string, unknown>>(
        'dataQuality:checkGaps',
        request
      );
      return {
        success: true,
        data: mapResponseFromApi(data, request),
      };
    }

    // Web: Use HTTP API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    const params = new URLSearchParams();
    params.append('symbol', request.symbol);
    params.append('exchange', request.exchange);
    params.append('from', request.fromTime.toString());
    params.append('to', request.toTime.toString());

    const url = `${apiUrl}/data-quality/gaps?${params.toString()}`;

    const response = await fetch(url, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to check trade gaps: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: mapResponseFromApi(data, request),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get gaps by exchange with pagination
 *
 * @param request - Request parameters
 * @returns Server action result with paginated gap records
 */
export async function getGapsByExchangeAction(
  request: GetGapsByExchangeRequest
): Promise<ServerActionResult<GetGapsByExchangeResponse>> {
  console.log(
    '[DataQualityController] getGapsByExchangeAction called:',
    request
  );

  try {
    const electronAPI = getElectronAPI();
    console.log('[DataQualityController] isElectron:', !!electronAPI);

    if (electronAPI) {
      // Electron: Use IPC
      console.log(
        '[DataQualityController] Calling IPC dataQuality:getGapsByExchange'
      );
      const data = await electronAPI.invoke<Record<string, unknown>>(
        'dataQuality:getGapsByExchange',
        request
      );
      console.log('[DataQualityController] IPC response:', data);
      return {
        success: true,
        data: mapGapsByExchangeResponse(data),
      };
    }

    // Web: Use HTTP API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    const params = new URLSearchParams();
    params.append('exchange', request.exchange);
    if (request.page !== undefined)
      params.append('page', request.page.toString());
    if (request.pageSize !== undefined)
      params.append('pageSize', request.pageSize.toString());
    if (request.search) params.append('search', request.search);
    if (request.severity && request.severity !== 'all')
      params.append('severity', request.severity);
    if (request.sortBy) params.append('sortBy', request.sortBy);
    if (request.sortOrder) params.append('sortOrder', request.sortOrder);

    const url = `${apiUrl}/data-quality/gaps-by-exchange?${params.toString()}`;

    const response = await fetch(url, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to get gaps by exchange: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: mapGapsByExchangeResponse(data),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Map API response to CheckTradeGapsResponse domain type
 */
function mapResponseFromApi(
  data: Record<string, unknown>,
  request: CheckTradeGapsRequest
): CheckTradeGapsResponse {
  const gaps = ((data.gaps as Array<Record<string, unknown>>) || []).map(
    (gap): TradeGap => ({
      from: gap.from as number,
      to: gap.to as number,
      duration: gap.duration as number,
    })
  );

  const totalMissingDuration = gaps.reduce((sum, gap) => sum + gap.duration, 0);
  const totalTimeRange = request.toTime - request.fromTime;
  const dataCompleteness =
    totalTimeRange > 0
      ? Math.max(
          0,
          Math.min(
            100,
            ((totalTimeRange - totalMissingDuration) / totalTimeRange) * 100
          )
        )
      : 100;

  return {
    gaps,
    totalGaps: (data.totalGaps as number) ?? gaps.length,
    totalMissingDuration:
      (data.totalMissingDuration as number) ?? totalMissingDuration,
    dataCompleteness: (data.dataCompleteness as number) ?? dataCompleteness,
    symbol: request.symbol,
    exchange: request.exchange,
    fromTime: request.fromTime,
    toTime: request.toTime,
    checkedAt: new Date(),
  };
}

/**
 * Map API response to GetGapsByExchangeResponse domain type
 */
function mapGapsByExchangeResponse(
  data: Record<string, unknown>
): GetGapsByExchangeResponse {
  const gapsData = (data.gaps as Array<Record<string, unknown>>) || [];
  const paginationData = (data.pagination as Record<string, unknown>) || {};

  const gaps: GapRecord[] = gapsData.map((gap) => ({
    id: (gap.id as string) || `${gap.exchange}-${gap.symbol}`,
    symbol: gap.symbol as string,
    exchange: gap.exchange as string,
    gapCount: (gap.gapCount as number) || 0,
    firstGapTime: (gap.firstGapTime as number) || 0,
    lastGapTime: (gap.lastGapTime as number) || 0,
    totalMissingTrades: (gap.totalMissingTrades as number) || 0,
    severity: (gap.severity as GapSeverity) || 'info',
  }));

  return {
    gaps,
    pagination: {
      page: (paginationData.page as number) || 0,
      pageSize: (paginationData.pageSize as number) || 25,
      totalCount: (paginationData.totalCount as number) || gaps.length,
      totalPages: (paginationData.totalPages as number) || 1,
    },
  };
}
