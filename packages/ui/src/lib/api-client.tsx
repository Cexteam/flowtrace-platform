'use client';

import { createContext, useContext, useMemo, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Candle, Footprint, Symbol } from './types';

// API Client interface - works with both HTTP and IPC
export interface ApiClient {
  getCandles(
    symbol: string,
    timeframe: string,
    limit?: number
  ): Promise<Candle[]>;
  getFootprint(
    symbol: string,
    timeframe: string,
    time: number
  ): Promise<Footprint>;
  getSymbols(): Promise<Symbol[]>;
  subscribeCandles(
    symbol: string,
    callback: (candle: Candle) => void
  ): () => void;
}

// HTTP implementation (for web)
export class HttpApiClient implements ApiClient {
  private socket: Socket | null = null;
  private subscriptions = new Map<string, Set<(candle: Candle) => void>>();

  constructor(private baseUrl: string) {}

  async getCandles(
    symbol: string,
    timeframe: string,
    limit = 100
  ): Promise<Candle[]> {
    const res = await fetch(
      `${this.baseUrl}/api/candles/${symbol}?timeframe=${timeframe}&limit=${limit}`
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch candles: ${res.statusText}`);
    }
    return res.json();
  }

  async getFootprint(
    symbol: string,
    timeframe: string,
    time: number
  ): Promise<Footprint> {
    const res = await fetch(
      `${this.baseUrl}/api/footprint/${symbol}?timeframe=${timeframe}&time=${time}`
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch footprint: ${res.statusText}`);
    }
    return res.json();
  }

  async getSymbols(): Promise<Symbol[]> {
    const res = await fetch(`${this.baseUrl}/api/symbols`);
    if (!res.ok) {
      throw new Error(`Failed to fetch symbols: ${res.statusText}`);
    }
    return res.json();
  }

  subscribeCandles(
    symbol: string,
    callback: (candle: Candle) => void
  ): () => void {
    // Initialize socket if not already done
    if (!this.socket) {
      this.socket = io(`${this.baseUrl}/ws`, {
        transports: ['websocket'],
      });

      this.socket.on('candle', (data: { symbol: string; candle: Candle }) => {
        const handlers = this.subscriptions.get(data.symbol);
        handlers?.forEach((handler) => handler(data.candle));
      });
    }

    // Add callback to subscriptions
    if (!this.subscriptions.has(symbol)) {
      this.subscriptions.set(symbol, new Set());
      this.socket.emit('subscribe', { symbol });
    }
    this.subscriptions.get(symbol)!.add(callback);

    // Return unsubscribe function
    return () => {
      const handlers = this.subscriptions.get(symbol);
      if (handlers) {
        handlers.delete(callback);
        if (handlers.size === 0) {
          this.subscriptions.delete(symbol);
          this.socket?.emit('unsubscribe', { symbol });
        }
      }
    };
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.subscriptions.clear();
  }
}

// IPC implementation (for Electron)
export class IpcApiClient implements ApiClient {
  private subscriptions = new Map<string, Set<(candle: Candle) => void>>();
  private unsubscribeFns = new Map<string, () => void>();

  async getCandles(
    symbol: string,
    timeframe: string,
    limit = 100
  ): Promise<Candle[]> {
    if (!window.electron) {
      throw new Error('Electron IPC not available');
    }
    return window.electron.invoke<Candle[]>('get-candles', {
      symbol,
      timeframe,
      limit,
    });
  }

  async getFootprint(
    symbol: string,
    timeframe: string,
    time: number
  ): Promise<Footprint> {
    if (!window.electron) {
      throw new Error('Electron IPC not available');
    }
    return window.electron.invoke<Footprint>('get-footprint', {
      symbol,
      timeframe,
      time,
    });
  }

  async getSymbols(): Promise<Symbol[]> {
    if (!window.electron) {
      throw new Error('Electron IPC not available');
    }
    // IPC returns { symbols: Symbol[], total: number }
    const result = await window.electron.invoke<{
      symbols: Symbol[];
      total: number;
    }>('symbols:getAll', {});
    return result.symbols;
  }

  subscribeCandles(
    symbol: string,
    callback: (candle: Candle) => void
  ): () => void {
    if (!window.electron) {
      throw new Error('Electron IPC not available');
    }

    // Add callback to subscriptions
    if (!this.subscriptions.has(symbol)) {
      this.subscriptions.set(symbol, new Set());

      // Subscribe to IPC channel
      const unsubscribe = window.electron.on(`candle:${symbol}`, (data) => {
        const handlers = this.subscriptions.get(symbol);
        handlers?.forEach((handler) => handler(data as Candle));
      });
      this.unsubscribeFns.set(symbol, unsubscribe);
    }
    this.subscriptions.get(symbol)!.add(callback);

    // Return unsubscribe function
    return () => {
      const handlers = this.subscriptions.get(symbol);
      if (handlers) {
        handlers.delete(callback);
        if (handlers.size === 0) {
          this.subscriptions.delete(symbol);
          const unsub = this.unsubscribeFns.get(symbol);
          unsub?.();
          this.unsubscribeFns.delete(symbol);
        }
      }
    };
  }
}

// Auto-detect environment and create appropriate client
export function createApiClient(): ApiClient {
  if (typeof window !== 'undefined' && window.electron) {
    return new IpcApiClient();
  }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  return new HttpApiClient(apiUrl);
}

// React Context for API Client
const ApiClientContext = createContext<ApiClient | null>(null);

interface ApiClientProviderProps {
  children: ReactNode;
}

export function ApiClientProvider({ children }: ApiClientProviderProps) {
  const client = useMemo(() => createApiClient(), []);

  return (
    <ApiClientContext.Provider value={client}>
      {children}
    </ApiClientContext.Provider>
  );
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext);
  if (!client) {
    throw new Error('useApiClient must be used within an ApiClientProvider');
  }
  return client;
}
