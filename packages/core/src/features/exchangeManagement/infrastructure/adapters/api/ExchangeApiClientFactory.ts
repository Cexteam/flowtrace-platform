/**
 * Exchange API Client Factory
 *
 * Factory pattern to create exchange API clients based on exchange type.
 * Uses DI container to get adapters (which inject ExchangeManagementPort for config).
 */

import { injectable, inject } from 'inversify';
import type { Exchange } from '../../../domain/types/Exchange.js';
import type { ExchangeApiClient } from '../../../application/ports/out/ExchangeApiClient.js';
import { EXCHANGE_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/exchangeManagement/types.js';
import { createLogger } from '../../../../../shared/lib/logger/logger.js';

const logger = createLogger('ExchangeApiClientFactory');

/**
 * Factory for creating exchange API clients
 * Clients are injected via DI to get config from database
 */
@injectable()
export class ExchangeApiClientFactory {
  private clients: Map<Exchange, ExchangeApiClient> = new Map();

  constructor(
    @inject(EXCHANGE_MANAGEMENT_TYPES.BinanceExchangeApiAdapter)
    private binanceAdapter: ExchangeApiClient,
    @inject(EXCHANGE_MANAGEMENT_TYPES.BybitExchangeApiAdapter)
    private bybitAdapter: ExchangeApiClient,
    @inject(EXCHANGE_MANAGEMENT_TYPES.OKXExchangeApiAdapter)
    private okxAdapter: ExchangeApiClient
  ) {
    // Pre-populate clients map with injected adapters
    this.clients.set('binance', binanceAdapter);
    this.clients.set('bybit', bybitAdapter);
    this.clients.set('okx', okxAdapter);
  }

  /**
   * Get exchange API client
   *
   * @param exchange - Exchange name
   * @returns Exchange API client
   * @throws Error if exchange is not supported
   */
  getClient(exchange: Exchange): ExchangeApiClient {
    const client = this.clients.get(exchange);
    if (!client) {
      throw new Error(`Unsupported exchange: ${exchange}`);
    }
    return client;
  }

  /**
   * Get all supported exchanges
   */
  getSupportedExchanges(): Exchange[] {
    return ['binance', 'bybit', 'okx'];
  }

  /**
   * Check if exchange is supported
   */
  isSupported(exchange: Exchange): boolean {
    return this.clients.has(exchange);
  }

  /**
   * Health check all clients
   */
  async healthCheckAll(): Promise<Record<Exchange, boolean>> {
    const results: Record<string, boolean> = {};

    for (const exchange of this.getSupportedExchanges()) {
      try {
        const client = this.getClient(exchange);
        results[exchange] = await client.healthCheck();
      } catch (error) {
        logger.error(`Health check failed for ${exchange}:`, error);
        results[exchange] = false;
      }
    }

    return results as Record<Exchange, boolean>;
  }
}
