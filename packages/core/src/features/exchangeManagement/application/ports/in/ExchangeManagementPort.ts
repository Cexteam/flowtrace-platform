/**
 * Exchange Management Port - Inbound Port (Driving Port)
 *
 * Defines the contract for exchange management operations.
 * External actors (API controllers, IPC handlers) interact through this interface.
 *
 * Hexagonal Architecture: This is a DRIVING port (inbound)
 * - Defines what external actors can do
 * - Implemented by ExchangeManagementService
 *
 */

import type {
  Exchange,
  ExchangeHealth,
} from '../../../domain/entities/Exchange.js';
import type { ImplementationStatus } from '../../../domain/value-objects/ExchangeStatus.js';

/**
 * Filter options for getting exchanges
 */
export interface ExchangeFilter {
  implementationStatus?: ImplementationStatus;
  enabled?: boolean;
}

/**
 * Exchange Management Port Interface
 *
 * Provides operations for managing cryptocurrency exchanges
 */
export interface ExchangeManagementPort {
  /**
   * Get all exchanges with optional filters
   *
   * @param filter - Optional filter criteria
   * @returns Array of exchanges
   */
  getExchanges(filter?: ExchangeFilter): Promise<Exchange[]>;

  /**
   * Get exchange by ID
   *
   * @param exchangeId - Exchange ID (e.g., 'binance', 'bybit')
   * @returns Exchange or null if not found
   */
  getExchangeById(exchangeId: string): Promise<Exchange | null>;

  /**
   * Get health status of an exchange
   *
   * @param exchangeId - Exchange ID
   * @returns Exchange health information
   */
  getExchangeHealth(exchangeId: string): Promise<ExchangeHealth>;

  /**
   * Enable an exchange for trading
   *
   * @param exchangeId - Exchange ID to enable
   * @returns Updated exchange
   * @throws Error if exchange cannot be enabled
   */
  enableExchange(exchangeId: string): Promise<Exchange>;

  /**
   * Disable an exchange
   *
   * @param exchangeId - Exchange ID to disable
   * @returns Updated exchange
   */
  disableExchange(exchangeId: string): Promise<Exchange>;
}
