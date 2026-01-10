/**
 * Symbol Management Port - Inbound Port (Driving Port)
 *
 * Defines the contract for symbol management operations.
 * External actors (cron jobs, controllers, CLI) interact through this interface.
 *
 * Hexagonal Architecture: This is a DRIVING port (inbound)
 * - Defines what external actors can do
 * - Implemented by SymbolManagementService
 * - Service orchestrates use cases
 */

import type { Exchange } from '../../../domain/types/ExchangeMetadata.js';
import type { Symbol } from '../../../domain/entities/Symbol.js';

/**
 * Sync result from exchange
 */
export interface SyncResult {
  success: boolean;
  exchange: Exchange;
  symbolsAdded: number;
  symbolsUpdated: number;
  symbolsDelisted: number;
  totalSymbols: number;
  errors?: string[];
  timestamp: Date;
}

/**
 * Symbol Management Port Interface
 *
 * Provides operations for managing trading symbols across exchanges
 * Includes both manual operations and scheduled synchronization
 */
export interface SymbolManagementPort {
  // ============================================================================
  // Symbol Operations
  // ============================================================================

  /**
   * Sync symbols from exchange
   * Fetches latest symbols from exchange API and updates database
   *
   * @param exchange - Exchange to sync from
   * @returns Sync result with statistics
   */
  syncSymbolsFromExchange(exchange: Exchange): Promise<SyncResult>;

  /**
   * Activate a symbol for trading
   * Enables symbol for data ingestion and processing
   *
   * @param symbolId - Symbol ID to activate
   * @returns Activated symbol
   */
  activateSymbol(symbolId: string): Promise<Symbol>;

  /**
   * Deactivate a symbol
   * Disables symbol from data ingestion
   *
   * @param symbolId - Symbol ID to deactivate
   * @returns Deactivated symbol
   */
  deactivateSymbol(symbolId: string): Promise<Symbol>;

  /**
   * Enable a symbol by admin
   * Sets enabledByAdmin flag to true
   *
   * @param symbolId - Symbol ID to enable
   * @returns Updated symbol
   */
  enableSymbolByAdmin(symbolId: string): Promise<Symbol>;

  /**
   * Disable a symbol by admin
   * Sets enabledByAdmin flag to false
   *
   * @param symbolId - Symbol ID to disable
   * @returns Updated symbol
   */
  disableSymbolByAdmin(symbolId: string): Promise<Symbol>;

  /**
   * Get all symbols with optional filters
   *
   * @param filters - Optional filters
   * @returns Array of symbols
   */
  getSymbols(filters?: {
    exchange?: Exchange;
    status?: string;
    enabledByAdmin?: boolean;
  }): Promise<Symbol[]>;

  /**
   * Get symbol by ID
   *
   * @param symbolId - Symbol ID
   * @returns Symbol or null if not found
   */
  getSymbolById(symbolId: string): Promise<Symbol | null>;

  /**
   * Update symbol configuration (bin multiplier)
   *
   * @param symbolId - Symbol ID
   * @param config - Configuration updates
   * @returns Updated symbol or null if not found
   */
  updateSymbolConfig(
    symbolId: string,
    config: { binMultiplier?: number | null }
  ): Promise<Symbol | null>;

  // ============================================================================
  // Scheduled Synchronization Operations
  // ============================================================================

  /**
   * Start scheduled symbol synchronization
   * Sets up recurring cron job to sync all enabled exchanges
   *
   * @returns Promise that resolves when scheduling is set up
   */
  startScheduledSync(): Promise<void>;

  /**
   * Stop scheduled symbol synchronization
   * Cancels the recurring cron job
   *
   * @returns Promise that resolves when scheduling is cancelled
   */
  stopScheduledSync(): Promise<void>;

  /**
   * Run symbol synchronization now for all enabled exchanges
   * Manual trigger for immediate synchronization
   *
   * @returns Promise that resolves when sync is complete
   */
  runSyncNow(): Promise<void>;
}
