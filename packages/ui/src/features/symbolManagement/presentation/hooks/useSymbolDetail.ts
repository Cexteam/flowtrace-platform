/**
 * useSymbolDetail Hook - Single symbol detail management
 *
 * Custom hook for fetching and managing a single symbol's state.
 * Follows the Controller → Hook → Component pattern.
 *
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Symbol, SymbolToggleResult } from '../../domain/types';
import {
  getSymbolByIdAction,
  activateSymbolAction,
  deactivateSymbolAction,
} from '../controllers/SymbolController';

interface UseSymbolDetailState {
  symbol: Symbol | null;
  loading: boolean;
  error: string | null;
  toggling: boolean;
}

interface UseSymbolDetailReturn extends UseSymbolDetailState {
  loadSymbol: (symbolId: string) => Promise<void>;
  refresh: () => Promise<void>;
  activate: () => Promise<SymbolToggleResult | null>;
  deactivate: () => Promise<SymbolToggleResult | null>;
}

/**
 * Hook for managing single symbol detail
 *
 * @param symbolId - Symbol ID to load
 * @returns Symbol detail state and actions
 */
export function useSymbolDetail(symbolId?: string): UseSymbolDetailReturn {
  const [state, setState] = useState<UseSymbolDetailState>({
    symbol: null,
    loading: !!symbolId,
    error: null,
    toggling: false,
  });

  const [currentSymbolId, setCurrentSymbolId] = useState<string | undefined>(
    symbolId
  );

  const loadSymbol = useCallback(async (id: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    setCurrentSymbolId(id);

    try {
      const result = await getSymbolByIdAction(id);

      if (result.success && result.data) {
        setState({
          symbol: result.data,
          loading: false,
          error: null,
          toggling: false,
        });
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: result.error || 'Failed to load symbol',
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
    if (currentSymbolId) {
      await loadSymbol(currentSymbolId);
    }
  }, [currentSymbolId, loadSymbol]);

  const activate = useCallback(async (): Promise<SymbolToggleResult | null> => {
    if (!currentSymbolId) return null;

    setState((prev) => ({ ...prev, toggling: true }));

    try {
      const result = await activateSymbolAction(currentSymbolId);

      if (result.success && result.data) {
        // Refresh symbol data after activation
        await loadSymbol(currentSymbolId);
        return result.data;
      } else {
        setState((prev) => ({
          ...prev,
          toggling: false,
          error: result.error || 'Failed to activate symbol',
        }));
        return null;
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        toggling: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
      return null;
    }
  }, [currentSymbolId, loadSymbol]);

  const deactivate =
    useCallback(async (): Promise<SymbolToggleResult | null> => {
      if (!currentSymbolId) return null;

      setState((prev) => ({ ...prev, toggling: true }));

      try {
        const result = await deactivateSymbolAction(currentSymbolId);

        if (result.success && result.data) {
          // Refresh symbol data after deactivation
          await loadSymbol(currentSymbolId);
          return result.data;
        } else {
          setState((prev) => ({
            ...prev,
            toggling: false,
            error: result.error || 'Failed to deactivate symbol',
          }));
          return null;
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          toggling: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        }));
        return null;
      }
    }, [currentSymbolId, loadSymbol]);

  // Initial load
  useEffect(() => {
    if (symbolId) {
      loadSymbol(symbolId);
    }
  }, [symbolId, loadSymbol]);

  return {
    ...state,
    loadSymbol,
    refresh,
    activate,
    deactivate,
  };
}
