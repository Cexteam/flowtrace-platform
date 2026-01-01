/**
 * useCandleDetail Hook - Candle detail with footprint data
 *
 * Custom hook for fetching candle detail with footprint data.
 *
 * Requirements: 14.1, 14.3
 */

'use client';

import { useState, useCallback } from 'react';
import type { CandleDetail, GetCandleDetailRequest } from '../../domain/types';
import { getCandleDetailAction } from '../controllers/FootprintController';

interface UseCandleDetailState {
  candleDetail: CandleDetail | null;
  loading: boolean;
  error: string | null;
}

interface UseCandleDetailReturn extends UseCandleDetailState {
  loadCandleDetail: (params: GetCandleDetailRequest) => Promise<void>;
  clearCandleDetail: () => void;
}

/**
 * Hook for managing candle detail with footprint data
 *
 * @returns Candle detail state and actions
 */
export function useCandleDetail(): UseCandleDetailReturn {
  const [state, setState] = useState<UseCandleDetailState>({
    candleDetail: null,
    loading: false,
    error: null,
  });

  const loadCandleDetail = useCallback(
    async (params: GetCandleDetailRequest) => {
      // Validate required params
      if (
        !params.exchange ||
        !params.symbol ||
        !params.timeframe ||
        !params.openTime
      ) {
        setState({
          candleDetail: null,
          loading: false,
          error: 'Missing required parameters',
        });
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await getCandleDetailAction(params);

        if (result.success && result.data) {
          setState({
            candleDetail: result.data,
            loading: false,
            error: null,
          });
        } else {
          setState({
            candleDetail: null,
            loading: false,
            error: result.error || 'Failed to load candle detail',
          });
        }
      } catch (err) {
        setState({
          candleDetail: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    []
  );

  const clearCandleDetail = useCallback(() => {
    setState({
      candleDetail: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    loadCandleDetail,
    clearCandleDetail,
  };
}
