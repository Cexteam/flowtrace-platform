/**
 * useCompletedCandles Hook - Completed candles data management
 *
 * Custom hook for fetching and managing completed candles data.
 * Supports date range filter and pagination.
 *
 * Requirements: 13.1, 13.3, 13.4
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Candle, GetCompletedCandlesRequest } from '../../domain/types';
import { getCompletedCandlesAction } from '../controllers/FootprintController';

interface UseCompletedCandlesState {
  candles: Candle[];
  totalCount: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
}

interface UseCompletedCandlesParams {
  exchange: string;
  symbol: string;
  timeframe: string;
  page?: number;
  pageSize?: number;
  startTime?: number;
  endTime?: number;
  sortOrder?: 'asc' | 'desc';
}

interface UseCompletedCandlesReturn extends UseCompletedCandlesState {
  loadCandles: (params: UseCompletedCandlesParams) => Promise<void>;
  refresh: () => Promise<void>;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setDateRange: (startTime?: number, endTime?: number) => void;
  setSortOrder: (sortOrder: 'asc' | 'desc') => void;
  currentParams: UseCompletedCandlesParams;
}

/**
 * Hook for managing completed candles data
 *
 * @param initialParams - Initial parameters for loading candles
 * @returns Candles data state and actions
 */
export function useCompletedCandles(
  initialParams?: Partial<UseCompletedCandlesParams>
): UseCompletedCandlesReturn {
  const [state, setState] = useState<UseCompletedCandlesState>({
    candles: [],
    totalCount: 0,
    totalPages: 0,
    loading: false,
    error: null,
  });

  const [currentParams, setCurrentParams] = useState<UseCompletedCandlesParams>(
    {
      exchange: initialParams?.exchange || '',
      symbol: initialParams?.symbol || '',
      timeframe: initialParams?.timeframe || '1m',
      page: initialParams?.page ?? 0,
      pageSize: initialParams?.pageSize ?? 25,
      startTime: initialParams?.startTime,
      endTime: initialParams?.endTime,
      sortOrder: initialParams?.sortOrder ?? 'desc', // Default: newest first
    }
  );

  const lastRequestRef = useRef<GetCompletedCandlesRequest | undefined>(
    undefined
  );

  const loadCandles = useCallback(async (params: UseCompletedCandlesParams) => {
    // Don't load if required params are missing
    if (!params.exchange || !params.symbol || !params.timeframe) {
      setState({
        candles: [],
        totalCount: 0,
        totalPages: 0,
        loading: false,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    setCurrentParams(params);

    const request: GetCompletedCandlesRequest = {
      exchange: params.exchange,
      symbol: params.symbol,
      timeframe: params.timeframe,
      page: params.page,
      pageSize: params.pageSize,
      startTime: params.startTime,
      endTime: params.endTime,
      sortOrder: params.sortOrder,
    };

    lastRequestRef.current = request;

    try {
      const result = await getCompletedCandlesAction(request);

      if (result.success && result.data) {
        setState({
          candles: result.data.candles,
          totalCount: result.data.pagination.totalCount,
          totalPages: result.data.pagination.totalPages,
          loading: false,
          error: null,
        });
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: result.error || 'Failed to load candles',
        }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadCandles(currentParams);
  }, [loadCandles, currentParams]);

  const setPage = useCallback(
    (page: number) => {
      const newParams = { ...currentParams, page };
      loadCandles(newParams);
    },
    [currentParams, loadCandles]
  );

  const setPageSize = useCallback(
    (pageSize: number) => {
      const newParams = { ...currentParams, pageSize, page: 0 };
      loadCandles(newParams);
    },
    [currentParams, loadCandles]
  );

  const setDateRange = useCallback(
    (startTime?: number, endTime?: number) => {
      const newParams = { ...currentParams, startTime, endTime, page: 0 };
      loadCandles(newParams);
    },
    [currentParams, loadCandles]
  );

  const setSortOrder = useCallback(
    (sortOrder: 'asc' | 'desc') => {
      const newParams = { ...currentParams, sortOrder };
      loadCandles(newParams);
    },
    [currentParams, loadCandles]
  );

  // Load candles when key params change
  useEffect(() => {
    if (
      initialParams?.exchange &&
      initialParams?.symbol &&
      initialParams?.timeframe
    ) {
      loadCandles({
        ...currentParams,
        exchange: initialParams.exchange,
        symbol: initialParams.symbol,
        timeframe: initialParams.timeframe,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialParams?.exchange,
    initialParams?.symbol,
    initialParams?.timeframe,
  ]);

  return {
    ...state,
    loadCandles,
    refresh,
    setPage,
    setPageSize,
    setDateRange,
    setSortOrder,
    currentParams,
  };
}
