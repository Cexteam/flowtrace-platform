/**
 * useWorkerWebSocket Hook - Real-time worker status updates
 *
 * Custom hook for subscribing to worker status changes via WebSocket.
 * Supports both HTTP WebSocket (Cloud) and IPC events (Desktop).
 *
 */

'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Worker, WorkerHealthMetrics } from '../../domain/types';

/**
 * Worker status update event types
 */
export type WorkerEventType =
  | 'worker:created'
  | 'worker:stateChanged'
  | 'worker:healthUpdated'
  | 'worker:symbolAssigned'
  | 'worker:symbolUnassigned'
  | 'worker:removed';

/**
 * Worker status update event
 */
export interface WorkerStatusEvent {
  type: WorkerEventType;
  workerId: string;
  data?: Partial<Worker> | WorkerHealthMetrics | string[];
  timestamp: number;
}

/**
 * WebSocket connection state
 */
export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

/**
 * Hook options
 */
interface UseWorkerWebSocketOptions {
  enabled?: boolean;
  onWorkerCreated?: (workerId: string, worker: Partial<Worker>) => void;
  onStateChanged?: (workerId: string, state: Worker['state']) => void;
  onHealthUpdated?: (workerId: string, health: WorkerHealthMetrics) => void;
  onSymbolAssigned?: (workerId: string, symbols: string[]) => void;
  onWorkerRemoved?: (workerId: string) => void;
}

/**
 * Hook return type
 */
interface UseWorkerWebSocketReturn {
  connectionState: ConnectionState;
  lastEvent: WorkerStatusEvent | null;
  subscribe: () => void;
  unsubscribe: () => void;
}

/**
 * Check if running in Electron environment
 * Note: preload.ts exposes API as 'electron', not 'electronAPI'
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && 'electron' in window;
}

/**
 * Hook for real-time worker status updates via WebSocket
 *
 * @param options - Hook options including event callbacks
 * @returns Connection state and control functions
 */
export function useWorkerWebSocket(
  options: UseWorkerWebSocketOptions = {}
): UseWorkerWebSocketReturn {
  const {
    enabled = true,
    onWorkerCreated,
    onStateChanged,
    onHealthUpdated,
    onSymbolAssigned,
    onWorkerRemoved,
  } = options;

  const [connectionState, setConnectionState] =
    useState<ConnectionState>('disconnected');
  const [lastEvent, setLastEvent] = useState<WorkerStatusEvent | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const ipcUnsubscribeRef = useRef<(() => void) | null>(null);

  /**
   * Handle incoming worker status event
   */
  const handleEvent = useCallback(
    (event: WorkerStatusEvent) => {
      setLastEvent(event);

      switch (event.type) {
        case 'worker:created':
          onWorkerCreated?.(event.workerId, event.data as Partial<Worker>);
          break;
        case 'worker:stateChanged':
          onStateChanged?.(
            event.workerId,
            (event.data as Partial<Worker>).state!
          );
          break;
        case 'worker:healthUpdated':
          onHealthUpdated?.(event.workerId, event.data as WorkerHealthMetrics);
          break;
        case 'worker:symbolAssigned':
        case 'worker:symbolUnassigned':
          onSymbolAssigned?.(event.workerId, event.data as string[]);
          break;
        case 'worker:removed':
          onWorkerRemoved?.(event.workerId);
          break;
      }
    },
    [
      onWorkerCreated,
      onStateChanged,
      onHealthUpdated,
      onSymbolAssigned,
      onWorkerRemoved,
    ]
  );

  /**
   * Subscribe to worker status updates
   */
  const subscribe = useCallback(() => {
    if (!enabled) return;

    if (isElectron()) {
      // Desktop: Use IPC events
      // Note: preload.ts exposes API as 'electron', not 'electronAPI'
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

      setConnectionState('connecting');

      try {
        ipcUnsubscribeRef.current = electronAPI.on(
          'worker:status',
          (data: unknown) => {
            handleEvent(data as WorkerStatusEvent);
          }
        );
        setConnectionState('connected');
      } catch {
        setConnectionState('error');
      }
    } else {
      // Cloud: Use Socket.IO
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      setConnectionState('connecting');

      const socket = io(apiUrl, {
        transports: ['websocket'],
        path: '/ws',
      });

      socket.on('connect', () => {
        setConnectionState('connected');
        socket.emit('subscribe', { channel: 'worker:status' });
      });

      socket.on('disconnect', () => {
        setConnectionState('disconnected');
      });

      socket.on('connect_error', () => {
        setConnectionState('error');
      });

      socket.on('worker:status', (data: WorkerStatusEvent) => {
        handleEvent(data);
      });

      socketRef.current = socket;
    }
  }, [enabled, handleEvent]);

  /**
   * Unsubscribe from worker status updates
   */
  const unsubscribe = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('unsubscribe', { channel: 'worker:status' });
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    if (ipcUnsubscribeRef.current) {
      ipcUnsubscribeRef.current();
      ipcUnsubscribeRef.current = null;
    }

    setConnectionState('disconnected');
  }, []);

  // Auto-subscribe on mount if enabled
  useEffect(() => {
    if (enabled) {
      subscribe();
    }

    return () => {
      unsubscribe();
    };
  }, [enabled, subscribe, unsubscribe]);

  return {
    connectionState,
    lastEvent,
    subscribe,
    unsubscribe,
  };
}
