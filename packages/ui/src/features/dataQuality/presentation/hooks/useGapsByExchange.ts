/**
 * useGapsByExchange Hook - Gap data management by exchange
 *
 * Custom hook for fetching and managing gap data filtered by exchange.
 * Supports pagination, search, and filtering.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  GapRecord,
  GetGapsByExchangeRequest,
  GapSeverity,
} from '../../domain/types';
import { getGapsByExchangeAction } from '../controllers/DataQualityController';

interface UseGapsByExchangeState {
  gaps: GapRecord[];
  totalCount: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
}

interface UseGapsByExchangeParams {
  exchange: string;
  page?: number;
  pageSize?: number;
  search?: string;
  severity?: 'all' | GapSeverity;
  sortBy?: 'gapCount' | 'totalMissingTrades' | 'lastGapTime' | 'symbol';
  sortOrder?: 'asc' | 'desc';
}

interface UseGapsByExchangeReturn extends UseGapsByExchangeState {
  loadGaps: (params: UseGapsByExchangeParams) => Promise<void>;
  refresh: () => Promise<void>;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSearch: (search: string) => void;
  setSeverity: (severity: 'all' | GapSeverity) => void;
  setSort: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  currentParams: UseGapsByExchangeParams;
}

/**
 * Hook for managing gap data by exchange
 *
 * @param initialExchange - Initial exchange to load gaps for
 * @param autoRefreshInterval - Optional interval in ms for auto-refresh (default: 0 = disabled)
 * @returns Gap data state and actions
 */
export function useGapsByExchange(
  initialExchange?: string,
  autoRefreshInterval = 0
): UseGapsByExchangeReturn {
  const [state, setState] = useState<UseGapsByExchangeState>({
    gaps: [],
    totalCount: 0,
    totalPages: 0,
    loading: false,
    error: null,
  });

  const [currentParams, setCurrentParams] = useState<UseGapsByExchangeParams>({
    exchange: initialExchange || '',
    page: 0,
    pageSize: 25,
    search: '',
    severity: 'all',
    sortBy: 'gapCount',
    sortOrder: 'desc',
  });

  const lastRequestRef = useRef<GetGapsByExchangeRequest | undefined>(
    undefined
  );

  const loadGaps = useCallback(async (params: UseGapsByExchangeParams) => {
    if (!params.exchange) {
      setState({
        gaps: [],
        totalCount: 0,
        totalPages: 0,
        loading: false,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    setCurrentParams(params);

    const request: GetGapsByExchangeRequest = {
      exchange: params.exchange,
      page: params.page,
      pageSize: params.pageSize,
      search: params.search,
      severity: params.severity,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    };

    lastRequestRef.current = request;

    try {
      const result = await getGapsByExchangeAction(request);

      if (result.success && result.data) {
        setState({
          gaps: result.data.gaps,
          totalCount: result.data.pagination.totalCount,
          totalPages: result.data.pagination.totalPages,
          loading: false,
          error: null,
        });
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: result.error || 'Failed to load gaps',
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
    await loadGaps(currentParams);
  }, [loadGaps, currentParams]);

  const setPage = useCallback(
    (page: number) => {
      const newParams = { ...currentParams, page };
      loadGaps(newParams);
    },
    [currentParams, loadGaps]
  );

  const setPageSize = useCallback(
    (pageSize: number) => {
      const newParams = { ...currentParams, pageSize, page: 0 };
      loadGaps(newParams);
    },
    [currentParams, loadGaps]
  );

  const setSearch = useCallback(
    (search: string) => {
      const newParams = { ...currentParams, search, page: 0 };
      loadGaps(newParams);
    },
    [currentParams, loadGaps]
  );

  const setSeverity = useCallback(
    (severity: 'all' | GapSeverity) => {
      const newParams = { ...currentParams, severity, page: 0 };
      loadGaps(newParams);
    },
    [currentParams, loadGaps]
  );

  const setSort = useCallback(
    (sortBy: string, sortOrder: 'asc' | 'desc') => {
      const newParams = {
        ...currentParams,
        sortBy: sortBy as UseGapsByExchangeParams['sortBy'],
        sortOrder,
      };
      loadGaps(newParams);
    },
    [currentParams, loadGaps]
  );

  // Load gaps when exchange changes
  useEffect(() => {
    if (initialExchange && initialExchange !== currentParams.exchange) {
      loadGaps({ ...currentParams, exchange: initialExchange, page: 0 });
    }
  }, [initialExchange, currentParams, loadGaps]);

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefreshInterval <= 0 || !currentParams.exchange) return;

    const intervalId = setInterval(() => {
      loadGaps(currentParams);
    }, autoRefreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefreshInterval, currentParams, loadGaps]);

  return {
    ...state,
    loadGaps,
    refresh,
    setPage,
    setPageSize,
    setSearch,
    setSeverity,
    setSort,
    currentParams,
  };
}
