/**
 * useWorkerDetail Hook - Single worker detail management
 *
 * Custom hook for fetching and managing single worker detail state.
 * Follows the Controller → Hook → Component pattern.
 * Auto-refreshes every 5 seconds to include new metrics (queueLength, processingLatencyMs, throughputTradesPerSecond).
 *
 * Requirements: 7.6 - Auto-refresh worker data every 5 seconds while detail panel is open
 * Requirements: 4.4 - Auto-refresh worker metrics every 5 seconds
 * Requirements: 17.3 - Auto-refresh worker statistics periodically
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Worker, WorkerHealthMetrics } from '../../domain/types';
import {
  getWorkerByIdAction,
  getWorkerHealthAction,
} from '../controllers/WorkerController';

interface UseWorkerDetailState {
  worker: Worker | null;
  healthMetrics: WorkerHealthMetrics | null;
  loading: boolean;
  error: string | null;
}

interface UseWorkerDetailReturn extends UseWorkerDetailState {
  loadWorker: () => Promise<void>;
  loadHealth: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing single worker detail
 *
 * @param workerId - Worker ID to fetch
 * @param autoRefreshInterval - Optional interval in ms for auto-refresh (default: 5000)
 * @returns Worker detail state and actions
 */
export function useWorkerDetail(
  workerId: string | null,
  autoRefreshInterval = 5000
): UseWorkerDetailReturn {
  const [state, setState] = useState<UseWorkerDetailState>({
    worker: null,
    healthMetrics: null,
    loading: false,
    error: null,
  });

  const loadWorker = useCallback(async () => {
    if (!workerId) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const result = await getWorkerByIdAction(workerId);

      if (result.success && result.data) {
        setState((prev) => ({
          ...prev,
          worker: result.data!,
          loading: false,
          error: null,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: result.error || 'Failed to load worker',
        }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, [workerId]);

  const loadHealth = useCallback(async () => {
    if (!workerId) return;

    try {
      const result = await getWorkerHealthAction(workerId);

      if (result.success && result.data) {
        setState((prev) => ({
          ...prev,
          healthMetrics: result.data!,
        }));
      }
    } catch {
      // Health metrics are optional, don't set error
    }
  }, [workerId]);

  const refresh = useCallback(async () => {
    await Promise.all([loadWorker(), loadHealth()]);
  }, [loadWorker, loadHealth]);

  // Initial load when workerId changes
  useEffect(() => {
    if (workerId) {
      loadWorker();
      loadHealth();
    } else {
      setState({
        worker: null,
        healthMetrics: null,
        loading: false,
        error: null,
      });
    }
  }, [workerId, loadWorker, loadHealth]);

  // Auto-refresh interval
  useEffect(() => {
    if (!workerId || autoRefreshInterval <= 0) return;

    const intervalId = setInterval(() => {
      loadWorker();
      loadHealth();
    }, autoRefreshInterval);

    return () => clearInterval(intervalId);
  }, [workerId, autoRefreshInterval, loadWorker, loadHealth]);

  return {
    ...state,
    loadWorker,
    loadHealth,
    refresh,
  };
}
