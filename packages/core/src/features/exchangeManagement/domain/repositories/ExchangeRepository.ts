/**
 * Exchange Repository Interface - Domain Layer
 *
 * Defines contract for exchange persistence.
 * Implemented by SQLite adapter with IPC-based persistence.
 *
 */

import { Exchange } from '../entities/Exchange.js';
import type { ImplementationStatus } from '../value-objects/ExchangeStatus.js';

/**
 * Filter options for finding exchanges
 */
export interface ExchangeFilter {
  implementationStatus?: ImplementationStatus;
  enabled?: boolean;
}

/**
 * Exchange Repository Interface
 * Defines the contract for exchange data persistence
 */
export interface ExchangeRepository {
  /**
   * Find all exchanges with optional filters
   * @param filter - Optional filter criteria
   * @returns Array of exchanges matching the filter
   */
  findAll(filter?: ExchangeFilter): Promise<Exchange[]>;

  /**
   * Find exchange by ID
   * @param id - Exchange ID (e.g., 'binance', 'bybit')
   * @returns Exchange or null if not found
   */
  findById(id: string): Promise<Exchange | null>;

  /**
   * Find all enabled exchanges
   * @returns Array of enabled exchanges
   */
  findEnabled(): Promise<Exchange[]>;

  /**
   * Save or update an exchange
   * @param exchange - Exchange entity to save
   * @returns Saved exchange
   */
  save(exchange: Exchange): Promise<Exchange>;

  /**
   * Update the enabled status of an exchange
   * @param id - Exchange ID
   * @param enabled - New enabled status
   */
  updateEnabled(id: string, enabled: boolean): Promise<void>;

  /**
   * Delete an exchange
   * @param id - Exchange ID to delete
   */
  delete(id: string): Promise<void>;

  /**
   * Check if an exchange exists
   * @param id - Exchange ID
   * @returns true if exchange exists
   */
  exists(id: string): Promise<boolean>;
}
