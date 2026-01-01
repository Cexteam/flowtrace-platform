/**
 * Symbol Management Domain Types
 *
 * Defines the domain entities and value objects for symbol management.
 * These types represent the core business concepts.
 *
 */

/**
 * Symbol status
 */
export type SymbolStatus =
  | 'active'
  | 'inactive'
  | 'delisted'
  | 'pending_review';

/**
 * Symbol configuration
 */
export interface SymbolConfig {
  tickValue: number;
  pricePrecision: number;
  quantityPrecision: number;
}

/**
 * Exchange-specific metadata for a symbol
 */
export interface ExchangeMetadata {
  exchangeSymbolId?: string;
  contractType?: string;
  marginAsset?: string;
  settlementAsset?: string;
  minNotional?: number;
  maxNotional?: number;
  minQuantity?: number;
  maxQuantity?: number;
  stepSize?: number;
  tickSize?: number;
  [key: string]: unknown;
}

/**
 * Symbol entity
 */
export interface Symbol {
  id: string;
  symbol: string;
  exchange: string;
  baseAsset: string;
  quoteAsset: string;
  status: SymbolStatus;
  enabledByAdmin: boolean;
  isStreaming: boolean;
  isProcessing: boolean;
  config: SymbolConfig;
  exchangeMetadata: ExchangeMetadata | null;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Symbol activation/deactivation result
 */
export interface SymbolToggleResult {
  success: boolean;
  symbolId: string;
  status: SymbolStatus;
  message?: string;
}

/**
 * Symbol sync result
 */
export interface SymbolSyncResult {
  success: boolean;
  exchange: string;
  symbolsAdded: number;
  symbolsUpdated: number;
  symbolsDelisted: number;
  syncedAt: Date;
  message?: string;
}
