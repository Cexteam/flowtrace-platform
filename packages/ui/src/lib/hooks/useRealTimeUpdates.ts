/**
 * useRealTimeUpdates Hook - Real-time status updates via IPC
 *
 * Custom hook for subscribing to real-time status changes from the main process.
 * Automatically invalidates React Query cache when status changes occur.
 *
 * Requirements: 17.1, 17.2
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { symbolQueryKeys } from '../../features/symbolManagement/presentation/hooks/useSymbolsPaginated';
import { exchangeQueryKeys } from '../../features/exchangeManagement/presentation/hooks/useExchangesPaginated';

/**
 * Symbol status update event from IPC
 */
export interface SymbolStatusEvent {
  type: 'status' | 'sync-complete';
  symbolId?: string;
  exchange?: string;
  status?: 'active' | 'inactive';
  enabledByAdmin?: boolean;
  isStreaming?: boolean;
  isProcessing?: boolean;
  timestamp?: number;
}

/**
 * Exchange status update event from IPC
 */
export interface ExchangeStatusEvent {
  type: 'status' | 'health';
  exchangeId?: string;
  exchange?: string;
  status?: 'enabled' | 'disabled';
  health?: 'connected' | 'disconnected' | 'error';
  timestamp?: number;
}

/**
 * Check if running in Electron environment
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && 'electron' in window;
}

/**
 * Get the Electron API if available
 */
function getElectronAPI(): {
  on: (channel: string, callback: (data: unknown) => void) => () => void;
} | null {
  if (!isElectron()) return null;
  return (
    window as unknown as {
      electron: {
        on: (channel: string, callback: (data: unknown) => void) => () => void;
      };
    }
  ).electron;
}

interface UseRealTimeUpdatesOptions {
  /** Enable symbol status updates (default: true) */
  enableSymbolUpdates?: boolean;
  /** Enable exchange status updates (default: true) */
  enableExchangeUpdates?: boolean;
  /** Callback when symbol status changes */
  onSymbolStatusChange?: (event: SymbolStatusEvent) => void;
  /** Callback when exchange status changes */
  onExchangeStatusChange?: (event: ExchangeStatusEvent) => void;
}

interface UseRealTimeUpdatesReturn {
  /** Whether connected to IPC events */
  isConnected: boolean;
}

/**
 * Hook for real-time status updates via IPC
 *
 * Listens for `symbol:status` and `exchange:status` events from the main process
 * and automatically invalidates React Query cache to trigger UI updates.
 *
 * @param options - Configuration options
 * @returns Connection state
 */
export function useRealTimeUpdates(
  options: UseRealTimeUpdatesOptions = {}
): UseRealTimeUpdatesReturn {
  const {
    enableSymbolUpdates = true,
    enableExchangeUpdates = true,
    onSymbolStatusChange,
    onExchangeStatusChange,
  } = options;

  const queryClient = useQueryClient();
  const isConnectedRef = useRef(false);

  // Handle symbol status updates
  const handleSymbolStatus = useCallback(
    (data: unknown) => {
      const event = data as SymbolStatusEvent;

      // Invalidate symbol queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: symbolQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: symbolQueryKeys.lists() });

      // Call user callback if provided
      onSymbolStatusChange?.(event);
    },
    [queryClient, onSymbolStatusChange]
  );

  // Handle exchange status updates
  const handleExchangeStatus = useCallback(
    (data: unknown) => {
      const event = data as ExchangeStatusEvent;

      // Invalidate exchange queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: exchangeQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: exchangeQueryKeys.lists() });

      // If exchange status changed, also invalidate symbol queries
      // since symbols depend on exchange status
      if (event.type === 'status') {
        queryClient.invalidateQueries({ queryKey: symbolQueryKeys.all });
        queryClient.invalidateQueries({ queryKey: symbolQueryKeys.lists() });
      }

      // Call user callback if provided
      onExchangeStatusChange?.(event);
    },
    [queryClient, onExchangeStatusChange]
  );

  // Set up IPC event listeners
  useEffect(() => {
    const electronAPI = getElectronAPI();

    if (!electronAPI) {
      // Not in Electron environment, skip IPC setup
      isConnectedRef.current = false;
      return;
    }

    const unsubscribeFns: (() => void)[] = [];

    // Subscribe to symbol status events
    if (enableSymbolUpdates) {
      const unsubSymbol = electronAPI.on('symbol:status', handleSymbolStatus);
      unsubscribeFns.push(unsubSymbol);
    }

    // Subscribe to exchange status events
    if (enableExchangeUpdates) {
      const unsubExchange = electronAPI.on(
        'exchange:status',
        handleExchangeStatus
      );
      unsubscribeFns.push(unsubExchange);
    }

    isConnectedRef.current = true;

    // Cleanup on unmount
    return () => {
      unsubscribeFns.forEach((unsub) => unsub());
      isConnectedRef.current = false;
    };
  }, [
    enableSymbolUpdates,
    enableExchangeUpdates,
    handleSymbolStatus,
    handleExchangeStatus,
  ]);

  return {
    isConnected: isConnectedRef.current,
  };
}
