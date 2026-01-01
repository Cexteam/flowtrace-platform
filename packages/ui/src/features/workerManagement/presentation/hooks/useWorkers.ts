/**
 * useWorkers Hook - Worker list management
 *
 * Custom hook for fetching and managing worker list state.
 * Follows the Controller → Hook → Component pattern.
 *
 * Requirements: 17.3 - Auto-refresh worker statistics periodically
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Worker } from '../../domain/types';
import type { GetWorkersRequest } from '../../application/ports/out/WorkerApiPort';
import { getWorkersAction } from '../controllers/WorkerController';

interface UseWorkersState {
  workers: Worker[];
  total: number;
  loading: boolean;
  error: string | null;
}

interface UseWorkersReturn extends UseWorkersState {
  loadWorkers: (request?: GetWorkersRequest) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing worker list
 *
 * @param autoRefreshInterval - Optional interval in ms for auto-refresh (default: 5000)
 * @returns Worker list state and actions
 */
export function useWorkers(autoRefreshInterval = 5000): UseWorkersReturn {
  const [state, setState] = useState<UseWorkersState>({
    workers: [],
    total: 0,
    loading: true,
    error: null,
  });

  const lastRequestRef = useRef<GetWorkersRequest | undefined>(undefined);

  const loadWorkers = useCallback(async (request?: GetWorkersRequest) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    lastRequestRef.current = request;

    try {
      const result = await getWorkersAction(request);

      if (result.success && result.data) {
        setState({
          workers: result.data.workers,
          total: result.data.total,
          loading: false,
          error: null,
        });
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: result.error || 'Failed to load workers',
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
    await loadWorkers(lastRequestRef.current);
  }, [loadWorkers]);

  // Initial load
  useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    const intervalId = setInterval(() => {
      loadWorkers(lastRequestRef.current);
    }, autoRefreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefreshInterval, loadWorkers]);

  return {
    ...state,
    loadWorkers,
    refresh,
  };
}
