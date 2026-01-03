// Application Layer - Input Port (Driving Port)
// Clean Architecture: Interface for trade ingestion operations called by presentation layer

/**
 * Trade Ingestion Port - Driving Interface
 *
 * Defines operations that external actors (controllers, CLI, HTTP layers)
 * can perform on the trade ingestion system via this port.
 */
export interface TradeIngestionPort {
  // Lifecycle Management
  startIngestion(request?: IngestionRequest): Promise<IngestionResult>;
  stopIngestion(): Promise<void>;

  // Dynamic Symbol Management
  addSymbols(symbols: string[]): Promise<{
    success: boolean;
    added: string[];
    failed: string[];
    message?: string;
  }>;

  removeSymbols(symbols: string[]): Promise<{
    success: boolean;
    removed: string[];
    failed: string[];
    message?: string;
  }>;

  // Monitoring & Status
  getStatus(): Promise<IngestionStatus>;

  // Utility Methods
  isHealthy(): Promise<boolean>;
}

/**
 * Additional DTOs for the port interface
 */

export interface IngestionRequest {
  /** Maximum number of symbols to track (optional) */
  maxSymbols?: number;

  /** Filter symbols by base assets (optional) */
  baseAssets?: string[];

  /** Symbol limit per connection (optional) */
  symbolsLimit?: number;

  /** Auto-restart on failure (optional) */
  autoRestart?: boolean;

  /** Custom initialization parameters */
  initParams?: Record<string, any>;
}

export interface IngestionResult {
  success: boolean;
  message?: string;
  connectedSymbols: string[];
  failedSymbols: string[];
  timestamp: Date;
  metadata?: {
    connectionId?: string;
    webSocketUrl?: string;
    elapsedMs?: number;
    /** True when service started but no active symbols to process */
    standbyMode?: boolean;
  };
}

export interface IngestionStatus {
  isRunning: boolean;
  connectedSymbols: string[];
  webSocketStatus?: {
    isConnected: boolean;
    url: string;
    lastHeartbeat?: number;
    reconnectCount?: number;
  };
  footprintInitialized: string[];
  timestamp: Date;
  uptime?: number;
  errors?: string[];
}
