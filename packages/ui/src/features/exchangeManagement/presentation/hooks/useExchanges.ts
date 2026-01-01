/**
 * useExchanges Hook - Exchange list management
 *
 * Custom hook for fetching and managing exchange list state.
 * Follows the Controller → Hook → Component pattern.
 *
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Exchange } from '../../domain/types';
import type { GetExchangesRequest } from '../../application/ports/out/ExchangeApiPort';
import { getExchangesAction } from '../controllers/ExchangeController';

interface UseExchangesState {
  exchanges: Exchange[];
  total: number;
  loading: boolean;
  error: string | null;
}

interface UseExchangesReturn extends UseExchangesState {
  loadExchanges: (request?: GetExchangesRequest) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing exchange list
 *
 * @param autoRefreshInterval - Optional interval in ms for auto-refresh (default: 30000)
 * @returns Exchange list state and actions
 */
export function useExchanges(autoRefreshInterval = 30000): UseExchangesReturn {
  const [state, setState] = useState<UseExchangesState>({
    exchanges: [],
    total: 0,
    loading: true,
    error: null,
  });

  const lastRequestRef = useRef<GetExchangesRequest | undefined>(undefined);

  const loadExchanges = useCallback(async (request?: GetExchangesRequest) => {
    console.log('[useExchanges] loadExchanges called with:', request);
    setState((prev) => ({ ...prev, loading: true, error: null }));
    lastRequestRef.current = request;

    try {
      console.log('[useExchanges] Calling getExchangesAction...');
      const result = await getExchangesAction(request);
      console.log('[useExchanges] getExchangesAction result:', result);

      if (result.success && result.data) {
        setState({
          exchanges: result.data.exchanges,
          total: result.data.total,
          loading: false,
          error: null,
        });
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: result.error || 'Failed to load exchanges',
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
    await loadExchanges(lastRequestRef.current);
  }, [loadExchanges]);

  // Initial load
  useEffect(() => {
    loadExchanges();
  }, [loadExchanges]);

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    const intervalId = setInterval(() => {
      loadExchanges(lastRequestRef.current);
    }, autoRefreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefreshInterval, loadExchanges]);

  return {
    ...state,
    loadExchanges,
    refresh,
  };
}
