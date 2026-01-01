/**
 * useExchangeToggle Hook - Exchange enable/disable management
 *
 * Custom hook for toggling exchange enabled state.
 * Uses React Query mutations with optimistic updates.
 * Shows toast notifications on success/failure.
 * Supports cascade deactivation of symbols when disabling exchange.
 *
 * Requirements: 5.1, 5.3, 5.4
 */

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from '../../../../components/ui/toast';
import type { ExchangeToggleResult } from '../../domain/types';
import {
  enableExchangeAction,
  disableExchangeAction,
} from '../controllers/ExchangeController';
import { exchangeQueryKeys } from './useExchangesPaginated';

/**
 * Toggle params
 */
export interface ToggleExchangeParams {
  exchangeName: string;
  enable: boolean;
}

/**
 * Hook return type
 */
export interface UseExchangeToggleReturn {
  /** Toggle exchange enabled state */
  toggleExchange: (params: ToggleExchangeParams) => void;
  /** Whether toggle is in progress */
  isToggling: boolean;
  /** Set of exchange names currently being toggled */
  togglingExchanges: Set<string>;
  /** Error message if any */
  error: string | null;
  /** Last toggle result */
  lastResult: ExchangeToggleResult | null;
  /** Clear error */
  clearError: () => void;
  /** Legacy: Enable exchange */
  enableExchange: (
    exchangeName: string
  ) => Promise<ExchangeToggleResult | null>;
  /** Legacy: Disable exchange */
  disableExchange: (
    exchangeName: string
  ) => Promise<ExchangeToggleResult | null>;
  /** Legacy: toggling state */
  toggling: boolean;
}

/**
 * Hook for toggling exchange enabled state
 *
 * @returns Toggle state and actions
 */
export function useExchangeToggle(): UseExchangeToggleReturn {
  const queryClient = useQueryClient();
  const [togglingExchanges, setTogglingExchanges] = useState<Set<string>>(
    new Set()
  );
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ExchangeToggleResult | null>(
    null
  );

  // Add exchange to toggling set
  const addToggling = useCallback((exchangeName: string) => {
    setTogglingExchanges((prev) => new Set(prev).add(exchangeName));
  }, []);

  // Remove exchange from toggling set
  const removeToggling = useCallback((exchangeName: string) => {
    setTogglingExchanges((prev) => {
      const next = new Set(prev);
      next.delete(exchangeName);
      return next;
    });
  }, []);

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ exchangeName, enable }: ToggleExchangeParams) => {
      if (enable) {
        return enableExchangeAction(exchangeName);
      } else {
        return disableExchangeAction(exchangeName);
      }
    },
    onMutate: async ({ exchangeName }) => {
      addToggling(exchangeName);
      setError(null);
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: exchangeQueryKeys.lists() });
    },
    onSuccess: (result, { exchangeName, enable }) => {
      if (result.success && result.data) {
        setLastResult(result.data);
        const action = enable ? 'enabled' : 'disabled';
        toast.success(`Exchange ${exchangeName} ${action} successfully`);

        // If disabling, also invalidate symbol queries for cascade effect
        if (!enable) {
          queryClient.invalidateQueries({ queryKey: ['symbols'] });
        }

        // Invalidate exchange queries to refetch
        queryClient.invalidateQueries({ queryKey: exchangeQueryKeys.lists() });
      } else {
        setError(result.error || 'Failed to toggle exchange');
        toast.error(result.error || 'Failed to toggle exchange');
      }
    },
    onError: (err) => {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to toggle exchange';
      setError(errorMessage);
      toast.error(errorMessage);
    },
    onSettled: (_, __, { exchangeName }) => {
      removeToggling(exchangeName);
    },
  });

  // Toggle handler
  const toggleExchange = useCallback(
    (params: ToggleExchangeParams) => {
      toggleMutation.mutate(params);
    },
    [toggleMutation]
  );

  // Legacy enable handler
  const enableExchange = useCallback(
    async (exchangeName: string): Promise<ExchangeToggleResult | null> => {
      addToggling(exchangeName);
      setError(null);

      try {
        const result = await enableExchangeAction(exchangeName);

        if (result.success && result.data) {
          setLastResult(result.data);
          toast.success(`Exchange ${exchangeName} enabled successfully`);
          queryClient.invalidateQueries({
            queryKey: exchangeQueryKeys.lists(),
          });
          return result.data;
        } else {
          setError(result.error || 'Failed to enable exchange');
          toast.error(result.error || 'Failed to enable exchange');
          return null;
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        toast.error(errorMessage);
        return null;
      } finally {
        removeToggling(exchangeName);
      }
    },
    [queryClient, addToggling, removeToggling]
  );

  // Legacy disable handler
  const disableExchange = useCallback(
    async (exchangeName: string): Promise<ExchangeToggleResult | null> => {
      addToggling(exchangeName);
      setError(null);

      try {
        const result = await disableExchangeAction(exchangeName);

        if (result.success && result.data) {
          setLastResult(result.data);
          toast.success(`Exchange ${exchangeName} disabled successfully`);
          // Invalidate both exchange and symbol queries for cascade effect
          queryClient.invalidateQueries({
            queryKey: exchangeQueryKeys.lists(),
          });
          queryClient.invalidateQueries({ queryKey: ['symbols'] });
          return result.data;
        } else {
          setError(result.error || 'Failed to disable exchange');
          toast.error(result.error || 'Failed to disable exchange');
          return null;
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        toast.error(errorMessage);
        return null;
      } finally {
        removeToggling(exchangeName);
      }
    },
    [queryClient, addToggling, removeToggling]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    toggleExchange,
    isToggling: toggleMutation.isPending,
    togglingExchanges,
    error,
    lastResult,
    clearError,
    // Legacy compatibility
    enableExchange,
    disableExchange,
    toggling: toggleMutation.isPending || togglingExchanges.size > 0,
  };
}
