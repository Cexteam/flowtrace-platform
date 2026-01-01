// Trading data types for the UI

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Tick {
  timestamp: number;
  price: number;
  quantity: number; // Positive = buy, negative = sell
}

export interface FootprintCluster {
  price: number;
  bidVolume: number;
  askVolume: number;
  delta: number;
}

export interface Footprint {
  timestamp: number;
  symbol: string;
  timeframe: string;
  clusters: FootprintCluster[];
  totalBidVolume: number;
  totalAskVolume: number;
  delta: number;
}

export interface Symbol {
  symbol: string;
  exchange: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  tickSize: number;
  stepSize: number;
}

// Electron IPC types
declare global {
  interface Window {
    electron?: {
      invoke: <T>(channel: string, data?: unknown) => Promise<T>;
      on: (channel: string, callback: (data: unknown) => void) => () => void;
    };
  }
}
