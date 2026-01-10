/**
 * ExchangeConfigAdapter - Infrastructure adapter for exchange configuration
 *
 * Implements ExchangeConfigPort by delegating to ExchangeManagementPort.
 * This adapter allows infrastructure adapters (e.g., BinanceWebSocketAdapter)
 * to get exchange config without depending on domain repositories directly.
 *
 * Hexagonal Architecture:
 * - Implements Port Out (ExchangeConfigPort)
 * - Delegates to Port In (ExchangeManagementPort) of another feature
 */

import { injectable, inject } from 'inversify';
import type {
  ExchangeConfigPort,
  ExchangeConfig,
} from '../../application/ports/out/ExchangeConfigPort.js';
import type { ExchangeManagementPort } from '../../../exchangeManagement/application/ports/in/ExchangeManagementPort.js';
import { EXCHANGE_MANAGEMENT_TYPES } from '../../../../shared/lib/di/bindings/features/exchangeManagement/types.js';
import { createLogger } from '../../../../shared/lib/logger/logger.js';

const logger = createLogger('ExchangeConfigAdapter');

/**
 * ExchangeConfigAdapter
 *
 * Infrastructure adapter that implements ExchangeConfigPort.
 * Delegates to ExchangeManagementPort for actual data retrieval.
 */
@injectable()
export class ExchangeConfigAdapter implements ExchangeConfigPort {
  constructor(
    @inject(EXCHANGE_MANAGEMENT_TYPES.ExchangeManagementPort)
    private exchangeManagementPort: ExchangeManagementPort
  ) {}

  /**
   * Get exchange configuration by ID
   *
   * @param exchangeId - Exchange identifier (e.g., 'binance', 'bybit')
   * @returns Exchange configuration or null if not found
   */
  async getExchangeConfig(exchangeId: string): Promise<ExchangeConfig | null> {
    try {
      const exchange = await this.exchangeManagementPort.getExchangeById(
        exchangeId
      );

      if (!exchange) {
        logger.warn(`Exchange config not found for: ${exchangeId}`);
        return null;
      }

      return {
        wsUrl: exchange.wsUrl,
        maxReconnectDelay: exchange.maxReconnectDelay,
        maxConnectAttempts: exchange.maxConnectAttempts,
      };
    } catch (error) {
      logger.error(`Failed to get exchange config for ${exchangeId}:`, error);
      return null;
    }
  }
}
