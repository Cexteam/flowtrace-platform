/**
 * useGapChecker Hook - Trade gap checking management
 *
 * Custom hook for checking trade data gaps and managing state.
 * Follows the Controller → Hook → Component pattern.
 *
 */

'use client';

import { useState, useCallback } from 'react';
import type {
  CheckTradeGapsRequest,
  CheckTradeGapsResponse,
} from '../../domain/types';
import { checkTradeGapsAction } from '../controllers/DataQualityController';

interface UseGapCheckerState {
  result: CheckTradeGapsResponse | null;
  loading: boolean;
  error: string | null;
}

interface UseGapCheckerReturn extends UseGapCheckerState {
  checkGaps: (request: CheckTradeGapsRequest) => Promise<void>;
  clearResult: () => void;
}

/**
 * Hook for managing trade gap checking
 *
 * @returns Gap checker state and actions
 */
export function useGapChecker(): UseGapCheckerReturn {
  const [state, setState] = useState<UseGapCheckerState>({
    result: null,
    loading: false,
    error: null,
  });

  const checkGaps = useCallback(async (request: CheckTradeGapsRequest) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const result = await checkTradeGapsAction(request);

      if (result.success && result.data) {
        setState({
          result: result.data,
          loading: false,
          error: null,
        });
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: result.error || 'Failed to check trade gaps',
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

  const clearResult = useCallback(() => {
    setState({
      result: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    checkGaps,
    clearResult,
  };
}
