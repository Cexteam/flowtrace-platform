/**
 * useSymbolWebSocket Hook - Real-time symbol status updates
 *
 * Custom hook for subscribing to real-time symbol status changes.
 * Supports both WebSocket (Cloud) and IPC events (Desktop/Electron).
 *
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SymbolStatus } from '../../domain/types';

/**
 * Symbol status update event from WebSocket/IPC
 */
export interface SymbolStatusUpdate {
  symbolId: string;
  status?: SymbolStatus;
  isStreaming?: boolean;
  isProcessing?: boolean;
  lastSyncAt?: Date;
}

/**
 * Symbol sync complete event from WebSocket/IPC
 */
export interface SymbolSyncCompleteEvent {
  exchange: string;
  symbolsAdded: number;
  symbolsUpdated: number;
  symbolsDelisted: number;
  syncedAt: Date;
}

interface UseSymbolWebSocketState {
  connected: boolean;
  lastUpdate: SymbolStatusUpdate | null;
  lastSyncEvent: SymbolSyncCompleteEvent | null;
}

interface UseSymbolWebSocketReturn extends UseSymbolWebSocketState {
  subscribe: (symbolIds?: string[]) => void;
  unsubscribe: () => void;
}

/**
 * Check if running in Electron environment
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && 'electron' in window;
}

/**
 * Hook for real-time symbol status updates via WebSocket or IPC
 *
 * @param onStatusUpdate - Callback when symbol status changes
 * @param onSyncComplete - Callback when sync completes
 * @returns WebSocket/IPC connection state and actions
 */
export function useSymbolWebSocket(
  onStatusUpdate?: (update: SymbolStatusUpdate) => void,
  onSyncComplete?: (event: SymbolSyncCompleteEvent) => void
): UseSymbolWebSocketReturn {
  const [state, setState] = useState<UseSymbolWebSocketState>({
    connected: false,
    lastUpdate: null,
    lastSyncEvent: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const ipcUnsubscribeRef = useRef<(() => void) | null>(null);
  const subscribedSymbolsRef = useRef<string[]>([]);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL ||
      `ws://${
        typeof window !== 'undefined' ? window.location.host : 'localhost:3001'
      }/ws`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setState((prev) => ({ ...prev, connected: true }));

        // Re-subscribe to symbols if any were subscribed before reconnect
        if (subscribedSymbolsRef.current.length > 0) {
          ws.send(
            JSON.stringify({
              type: 'subscribe',
              channel: 'symbol:status',
              symbolIds: subscribedSymbolsRef.current,
            })
          );
        }
      };

      ws.onclose = () => {
        setState((prev) => ({ ...prev, connected: false }));

        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          connectWebSocket();
        }, 5000);
      };

      ws.onerror = () => {
        setState((prev) => ({ ...prev, connected: false }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'symbol:status') {
            const update: SymbolStatusUpdate = {
              symbolId: data.symbolId,
              status: data.status,
              isStreaming: data.isStreaming,
              isProcessing: data.isProcessing,
              lastSyncAt: data.lastSyncAt
                ? new Date(data.lastSyncAt)
                : undefined,
            };

            setState((prev) => ({ ...prev, lastUpdate: update }));
            onStatusUpdate?.(update);
          }

          if (data.type === 'symbol:sync-complete') {
            const syncEvent: SymbolSyncCompleteEvent = {
              exchange: data.exchange,
              symbolsAdded: data.symbolsAdded,
              symbolsUpdated: data.symbolsUpdated,
              symbolsDelisted: data.symbolsDelisted,
              syncedAt: new Date(data.syncedAt),
            };

            setState((prev) => ({ ...prev, lastSyncEvent: syncEvent }));
            onSyncComplete?.(syncEvent);
          }
        } catch {
          // Ignore invalid JSON messages
        }
      };

      wsRef.current = ws;
    } catch {
      // WebSocket connection failed
      setState((prev) => ({ ...prev, connected: false }));
    }
  }, [onStatusUpdate, onSyncComplete]);

  const connectIPC = useCallback(() => {
    if (ipcUnsubscribeRef.current) {
      return; // Already connected
    }

    const electronAPI = (
      window as unknown as {
        electron: {
          on: (
            channel: string,
            callback: (data: unknown) => void
          ) => () => void;
        };
      }
    ).electron;

    try {
      // Subscribe to symbol status updates
      ipcUnsubscribeRef.current = electronAPI.on(
        'symbol:status',
        (data: unknown) => {
          const eventData = data as { type: string; [key: string]: unknown };

          if (eventData.type === 'status') {
            const update: SymbolStatusUpdate = {
              symbolId: eventData.symbolId as string,
              status: eventData.status as SymbolStatus | undefined,
              isStreaming: eventData.isStreaming as boolean | undefined,
              isProcessing: eventData.isProcessing as boolean | undefined,
              lastSyncAt: eventData.lastSyncAt
                ? new Date(eventData.lastSyncAt as string)
                : undefined,
            };

            setState((prev) => ({ ...prev, lastUpdate: update }));
            onStatusUpdate?.(update);
          }

          if (eventData.type === 'sync-complete') {
            const syncEvent: SymbolSyncCompleteEvent = {
              exchange: eventData.exchange as string,
              symbolsAdded: eventData.symbolsAdded as number,
              symbolsUpdated: eventData.symbolsUpdated as number,
              symbolsDelisted: eventData.symbolsDelisted as number,
              syncedAt: new Date(eventData.syncedAt as string),
            };

            setState((prev) => ({ ...prev, lastSyncEvent: syncEvent }));
            onSyncComplete?.(syncEvent);
          }
        }
      );

      setState((prev) => ({ ...prev, connected: true }));
    } catch {
      setState((prev) => ({ ...prev, connected: false }));
    }
  }, [onStatusUpdate, onSyncComplete]);

  const subscribe = useCallback(
    (symbolIds?: string[]) => {
      subscribedSymbolsRef.current = symbolIds || [];

      if (isElectron()) {
        // Electron: Use IPC
        connectIPC();
      } else {
        // Web: Use WebSocket
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          connectWebSocket();
          return;
        }

        wsRef.current.send(
          JSON.stringify({
            type: 'subscribe',
            channel: 'symbol:status',
            symbolIds: symbolIds || [],
          })
        );
      }
    },
    [connectWebSocket, connectIPC]
  );

  const unsubscribe = useCallback(() => {
    subscribedSymbolsRef.current = [];

    if (isElectron()) {
      // Electron: Cleanup IPC listener
      if (ipcUnsubscribeRef.current) {
        ipcUnsubscribeRef.current();
        ipcUnsubscribeRef.current = null;
      }
    } else {
      // Web: Unsubscribe from WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'unsubscribe',
            channel: 'symbol:status',
          })
        );
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (ipcUnsubscribeRef.current) {
        ipcUnsubscribeRef.current();
        ipcUnsubscribeRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}
