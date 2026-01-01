/**
 * useSymbolSync Hook - Symbol sync management
 *
 * Custom hook for managing symbol sync operations.
 * Follows the Controller → Hook → Component pattern.
 *
 */

'use client';

import { useState, useCallback } from 'react';
import type { SymbolSyncResult } from '../../domain/types';
import { syncSymbolsAction } from '../controllers/SymbolController';

interface UseSymbolSyncState {
  syncing: boolean;
  lastSyncResult: SymbolSyncResult | null;
  error: string | null;
}

interface UseSymbolSyncReturn extends UseSymbolSyncState {
  syncSymbols: (exchange: string) => Promise<SymbolSyncResult | null>;
  clearError: () => void;
  clearLastResult: () => void;
}

/**
 * Hook for managing symbol sync operations
 *
 * @returns Symbol sync state and actions
 */
export function useSymbolSync(): UseSymbolSyncReturn {
  const [state, setState] = useState<UseSymbolSyncState>({
    syncing: false,
    lastSyncResult: null,
    error: null,
  });

  const syncSymbols = useCallback(
    async (exchange: string): Promise<SymbolSyncResult | null> => {
      setState((prev) => ({
        ...prev,
        syncing: true,
        error: null,
      }));

      try {
        const result = await syncSymbolsAction(exchange);

        if (result.success && result.data) {
          setState({
            syncing: false,
            lastSyncResult: result.data,
            error: null,
          });
          return result.data;
        } else {
          setState((prev) => ({
            ...prev,
            syncing: false,
            error: result.error || 'Failed to sync symbols',
          }));
          return null;
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          syncing: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        }));
        return null;
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const clearLastResult = useCallback(() => {
    setState((prev) => ({ ...prev, lastSyncResult: null }));
  }, []);

  return {
    ...state,
    syncSymbols,
    clearError,
    clearLastResult,
  };
}
