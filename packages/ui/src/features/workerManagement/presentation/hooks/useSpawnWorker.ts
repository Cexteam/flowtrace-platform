/**
 * useSpawnWorker Hook - Worker spawning management
 *
 * Custom hook for spawning new workers with configuration.
 * Follows the Controller → Hook → Component pattern.
 *
 */

'use client';

import { useState, useCallback } from 'react';
import type { WorkerSpawnConfig, WorkerSpawnResult } from '../../domain/types';
import { spawnWorkerAction } from '../controllers/WorkerController';

interface UseSpawnWorkerState {
  spawning: boolean;
  result: WorkerSpawnResult | null;
  error: string | null;
}

interface UseSpawnWorkerReturn extends UseSpawnWorkerState {
  spawnWorker: (config: WorkerSpawnConfig) => Promise<WorkerSpawnResult | null>;
  reset: () => void;
}

/**
 * Hook for spawning new workers
 *
 * @returns Spawn state and actions
 */
export function useSpawnWorker(): UseSpawnWorkerReturn {
  const [state, setState] = useState<UseSpawnWorkerState>({
    spawning: false,
    result: null,
    error: null,
  });

  const spawnWorker = useCallback(
    async (config: WorkerSpawnConfig): Promise<WorkerSpawnResult | null> => {
      setState({ spawning: true, result: null, error: null });

      try {
        const actionResult = await spawnWorkerAction(config);

        if (actionResult.success && actionResult.data) {
          setState({
            spawning: false,
            result: actionResult.data,
            error: null,
          });
          return actionResult.data;
        } else {
          setState({
            spawning: false,
            result: null,
            error: actionResult.error || 'Failed to spawn worker',
          });
          return null;
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        setState({
          spawning: false,
          result: null,
          error: errorMessage,
        });
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({
      spawning: false,
      result: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    spawnWorker,
    reset,
  };
}
