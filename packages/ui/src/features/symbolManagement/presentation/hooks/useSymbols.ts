/**
 * useSymbols Hook - Symbol list management
 *
 * Custom hook for fetching and managing symbol list state.
 * Follows the Controller → Hook → Component pattern.
 *
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Symbol, SymbolStatus } from '../../domain/types';
import type { GetSymbolsRequest } from '../../application/ports/out/SymbolApiPort';
import { getSymbolsAction } from '../controllers/SymbolController';

interface UseSymbolsState {
  symbols: Symbol[];
  total: number;
  loading: boolean;
  error: string | null;
}

interface UseSymbolsReturn extends UseSymbolsState {
  loadSymbols: (request?: GetSymbolsRequest) => Promise<void>;
  refresh: () => Promise<void>;
  filterByExchange: (exchange: string | undefined) => Promise<void>;
  filterByStatus: (status: SymbolStatus | undefined) => Promise<void>;
}

/**
 * Hook for managing symbol list
 *
 * @param initialExchange - Optional initial exchange filter
 * @param autoRefreshInterval - Optional interval in ms for auto-refresh (default: 10000)
 * @returns Symbol list state and actions
 */
export function useSymbols(
  initialExchange?: string,
  autoRefreshInterval = 10000
): UseSymbolsReturn {
  const [state, setState] = useState<UseSymbolsState>({
    symbols: [],
    total: 0,
    loading: true,
    error: null,
  });

  const lastRequestRef = useRef<GetSymbolsRequest | undefined>(
    initialExchange ? { exchange: initialExchange } : undefined
  );

  const loadSymbols = useCallback(async (request?: GetSymbolsRequest) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    lastRequestRef.current = request;

    try {
      const result = await getSymbolsAction(request);

      if (result.success && result.data) {
        setState({
          symbols: result.data.symbols,
          total: result.data.total,
          loading: false,
          error: null,
        });
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: result.error || 'Failed to load symbols',
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
    await loadSymbols(lastRequestRef.current);
  }, [loadSymbols]);

  const filterByExchange = useCallback(
    async (exchange: string | undefined) => {
      const newRequest = {
        ...lastRequestRef.current,
        exchange,
      };
      await loadSymbols(newRequest);
    },
    [loadSymbols]
  );

  const filterByStatus = useCallback(
    async (status: SymbolStatus | undefined) => {
      const newRequest = {
        ...lastRequestRef.current,
        status,
      };
      await loadSymbols(newRequest);
    },
    [loadSymbols]
  );

  // Initial load
  useEffect(() => {
    loadSymbols(lastRequestRef.current);
  }, [loadSymbols]);

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    const intervalId = setInterval(() => {
      loadSymbols(lastRequestRef.current);
    }, autoRefreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefreshInterval, loadSymbols]);

  return {
    ...state,
    loadSymbols,
    refresh,
    filterByExchange,
    filterByStatus,
  };
}
