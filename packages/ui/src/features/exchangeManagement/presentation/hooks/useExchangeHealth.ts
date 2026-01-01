/**
 * useExchangeHealth Hook - Exchange health check management
 *
 * Custom hook for fetching exchange health status.
 * Follows the Controller → Hook → Component pattern.
 *
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import type { ExchangeHealthCheck } from '../../domain/types';
import { getExchangeHealthAction } from '../controllers/ExchangeController';

interface UseExchangeHealthState {
  health: ExchangeHealthCheck | null;
  loading: boolean;
  error: string | null;
}

interface UseExchangeHealthReturn extends UseExchangeHealthState {
  checkHealth: () => Promise<void>;
}

/**
 * Hook for managing exchange health check
 *
 * @param exchangeName - Exchange name to check health for
 * @param autoCheckInterval - Optional interval in ms for auto-check (default: 60000)
 * @returns Health check state and actions
 */
export function useExchangeHealth(
  exchangeName: string | null,
  autoCheckInterval = 60000
): UseExchangeHealthReturn {
  const [state, setState] = useState<UseExchangeHealthState>({
    health: null,
    loading: false,
    error: null,
  });

  const checkHealth = useCallback(async () => {
    if (!exchangeName) {
      setState({ health: null, loading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const result = await getExchangeHealthAction(exchangeName);

      if (result.success && result.data) {
        setState({
          health: result.data,
          loading: false,
          error: null,
        });
      } else {
        setState({
          health: null,
          loading: false,
          error: result.error || 'Failed to check exchange health',
        });
      }
    } catch (err) {
      setState({
        health: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [exchangeName]);

  // Initial check when exchange name changes
  useEffect(() => {
    if (exchangeName) {
      checkHealth();
    } else {
      setState({ health: null, loading: false, error: null });
    }
  }, [exchangeName, checkHealth]);

  // Auto-check interval
  useEffect(() => {
    if (!exchangeName || autoCheckInterval <= 0) return;

    const intervalId = setInterval(checkHealth, autoCheckInterval);
    return () => clearInterval(intervalId);
  }, [exchangeName, autoCheckInterval, checkHealth]);

  return {
    ...state,
    checkHealth,
  };
}
