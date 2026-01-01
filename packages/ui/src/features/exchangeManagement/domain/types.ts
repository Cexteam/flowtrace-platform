/**
 * Exchange Management Domain Types
 *
 * Defines the domain entities and value objects for exchange management.
 * These types represent the core business concepts.
 *
 */

/**
 * Exchange implementation status
 */
export type ExchangeImplementationStatus = 'implemented' | 'not_implemented';

/**
 * Exchange health status
 */
export type ExchangeHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'unhealthy'
  | 'unknown';

/**
 * Exchange health check result
 */
export interface ExchangeHealthCheck {
  status: ExchangeHealthStatus;
  latencyMs: number;
  lastCheckedAt: Date;
  errorMessage?: string;
}

/**
 * Exchange supported features
 */
export interface ExchangeFeatures {
  spotTrading: boolean;
  futuresTrading: boolean;
  marginTrading: boolean;
  websocketStreaming: boolean;
  historicalData: boolean;
}

/**
 * Exchange sync history entry
 */
export interface ExchangeSyncHistoryEntry {
  syncedAt: Date;
  symbolsAdded: number;
  symbolsUpdated: number;
  symbolsDelisted: number;
  success: boolean;
  errorMessage?: string;
}

/**
 * Exchange entity
 */
export interface Exchange {
  name: string;
  displayName: string;
  implementationStatus: ExchangeImplementationStatus;
  healthStatus: ExchangeHealthStatus;
  symbolCount: number;
  lastHealthCheck: Date | null;
  isEnabled: boolean;
  features: ExchangeFeatures;
  apiStatus: 'online' | 'offline' | 'maintenance';
  syncHistory: ExchangeSyncHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Exchange enable/disable result
 */
export interface ExchangeToggleResult {
  success: boolean;
  exchangeName: string;
  isEnabled: boolean;
  message?: string;
}
