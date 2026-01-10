/**
 * DTOs for RouteTrades Use Case
 * Request/response types for trade routing business logic
 */

/**
 * Symbol configuration for trade processing
 */
export interface SymbolTradeConfig {
  exchange: string;
  tickValue: number;
  binMultiplier?: number | null;
}

export interface RouteTradesRequest {
  symbol: string;
  trades: unknown[];
  config?: SymbolTradeConfig;
  priority?: 'urgent' | 'normal';
  batchId?: string;
  timestamp?: Date;
}

export interface RouteTradesSuccess {
  success: true;
  workerId: string;
  processingTime: number;
  symbol: string;
  tradeCount: number;
  batchId?: string;
}

export interface RouteTradesError {
  success: false;
  symbol: string;
  error: string;
  timestamp: Date;
}

export type RouteTradesResult = RouteTradesSuccess | RouteTradesError;
