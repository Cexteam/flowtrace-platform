/**
 * Bybit Exchange API Adapter
 *
 * Implements ExchangeApiClient for Bybit Futures API v5.
 * Exchange config (URLs) loaded from database via ExchangeRepository.
 */

import { injectable, inject } from 'inversify';
import {
  ExchangeApiClient,
  ExchangeSymbol,
  ExchangeApiError,
} from '../../../application/ports/out/ExchangeApiClient.js';
import { createLogger } from '../../../../../shared/lib/logger/logger.js';
import { EXCHANGE_MANAGEMENT_SYMBOLS } from '../../../../../shared/lib/di/bindings/features/exchangeManagement/types.js';
import type { ExchangeRepository } from '../../../domain/repositories/ExchangeRepository.js';
import type { Exchange } from '../../../domain/entities/Exchange.js';

const logger = createLogger('BybitExchangeApiAdapter');

interface BybitSymbolInfo {
  symbol: string;
  status: 'Trading' | 'Closed' | 'Settling';
  baseCoin: string;
  quoteCoin: string;
  settleCoin: string;
  contractType: 'LinearPerpetual' | 'InversePerpetual' | 'LinearFutures';
  priceScale: number;
  lotSizeFilter: {
    minOrderQty: string;
    maxOrderQty: string;
    qtyStep: string;
  };
  priceFilter: {
    minPrice: string;
    maxPrice: string;
    tickSize: string;
  };
}

interface BybitInstrumentsResponse {
  retCode: number;
  retMsg: string;
  result: {
    category: string;
    list: BybitSymbolInfo[];
  };
}

@injectable()
export class BybitExchangeApiAdapter implements ExchangeApiClient {
  private exchangeConfig: Exchange | null = null;
  private cache: {
    symbols?: ExchangeSymbol[];
    lastFetch?: number;
    ttl: number;
  };

  constructor(
    @inject(EXCHANGE_MANAGEMENT_SYMBOLS.ExchangeRepository)
    private exchangeRepository: ExchangeRepository
  ) {
    this.cache = {
      ttl: 5 * 60 * 1000, // 5 minutes
    };
  }

  /**
   * Get exchange config (lazy loading with cache)
   */
  private async getExchangeConfig(): Promise<Exchange> {
    if (!this.exchangeConfig) {
      this.exchangeConfig = await this.exchangeRepository.findById('bybit');
      if (!this.exchangeConfig) {
        throw new Error('Bybit exchange config not found in database');
      }
      logger.info('Loaded Bybit config from database', {
        restUrl: this.exchangeConfig.restUrl,
      });
    }
    return this.exchangeConfig;
  }

  /**
   * Get base URL from config
   */
  private async getBaseUrl(): Promise<string> {
    const config = await this.getExchangeConfig();
    return config.restUrl;
  }

  /**
   * Get exchange name
   */
  getExchange() {
    return 'bybit' as const;
  }

  /**
   * Fetch all active USDT symbols from Bybit
   */
  async fetchSymbols(): Promise<ExchangeSymbol[]> {
    try {
      // Check cache
      if (this.cache.symbols && this.cache.lastFetch) {
        const age = Date.now() - this.cache.lastFetch;
        if (age < this.cache.ttl) {
          logger.debug('Returning cached symbols', { age });
          return this.cache.symbols;
        }
      }

      logger.debug('Fetching active symbols from Bybit');

      const baseUrl = await this.getBaseUrl();

      // Fetch from Bybit API v5
      const response = await fetch(
        `${baseUrl}/v5/market/instruments-info?category=linear`
      );

      if (!response.ok) {
        throw new Error(
          `Bybit API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as BybitInstrumentsResponse;

      if (data.retCode !== 0) {
        throw new Error(`Bybit API error: ${data.retMsg}`);
      }

      // Filter USDT perpetuals and map to ExchangeSymbol
      const symbols = data.result.list
        .filter(
          (s) =>
            s.status === 'Trading' &&
            s.quoteCoin === 'USDT' &&
            s.contractType === 'LinearPerpetual'
        )
        .map((s) => this.mapToExchangeSymbol(s));

      // Update cache
      this.cache.symbols = symbols;
      this.cache.lastFetch = Date.now();

      logger.info(`Fetched ${symbols.length} active symbols from Bybit`);
      return symbols;
    } catch (error: any) {
      logger.error('Failed to fetch active symbols from Bybit:', error);

      // Return cached data if available
      if (this.cache.symbols) {
        logger.warn('Returning stale cached data due to API error');
        return this.cache.symbols;
      }

      throw new ExchangeApiError(
        'bybit',
        error.statusCode,
        'Failed to fetch active symbols',
        error
      );
    }
  }

  /**
   * Get detailed information for a specific symbol
   */
  async getExchangeInfo(symbol: string): Promise<ExchangeSymbol | null> {
    try {
      logger.debug(`Fetching symbol info for ${symbol} from Bybit`);

      const baseUrl = await this.getBaseUrl();

      const response = await fetch(
        `${baseUrl}/v5/market/instruments-info?category=linear&symbol=${symbol}`
      );

      if (!response.ok) {
        throw new Error(
          `Bybit API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as BybitInstrumentsResponse;

      if (data.retCode !== 0) {
        throw new Error(`Bybit API error: ${data.retMsg}`);
      }

      const bybitSymbol = data.result.list[0];

      if (!bybitSymbol) {
        return null;
      }

      return this.mapToExchangeSymbol(bybitSymbol);
    } catch (error: any) {
      logger.error(`Failed to fetch symbol info for ${symbol}:`, error);
      throw new ExchangeApiError(
        'bybit',
        error.statusCode,
        `Failed to fetch symbol info for ${symbol}`,
        error
      );
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const baseUrl = await this.getBaseUrl();
      const response = await fetch(`${baseUrl}/v5/market/time`);
      return response.ok;
    } catch (error) {
      logger.error('Bybit health check failed:', error);
      return false;
    }
  }

  /**
   * Get rate limits
   */
  getRateLimits() {
    return {
      requestsPerMinute: 600,
      requestsPerSecond: 10,
    };
  }

  /**
   * Fetch current prices for all symbols
   * Uses /v5/market/tickers endpoint
   */
  async fetchPrices(): Promise<Map<string, number>> {
    try {
      const baseUrl = await this.getBaseUrl();
      logger.debug('Fetching prices from Bybit');

      const response = await fetch(
        `${baseUrl}/v5/market/tickers?category=linear`
      );

      if (!response.ok) {
        throw new Error(
          `Bybit API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as {
        retCode: number;
        retMsg: string;
        result: {
          list: Array<{
            symbol: string;
            lastPrice: string;
          }>;
        };
      };

      if (data.retCode !== 0) {
        throw new Error(`Bybit API error: ${data.retMsg}`);
      }

      const priceMap = new Map<string, number>();
      for (const item of data.result.list) {
        priceMap.set(item.symbol, parseFloat(item.lastPrice));
      }

      logger.info(`Fetched ${priceMap.size} prices from Bybit`);
      return priceMap;
    } catch (error: any) {
      logger.error('Failed to fetch prices from Bybit:', error);
      throw new ExchangeApiError(
        'bybit',
        error.statusCode,
        'Failed to fetch prices',
        error
      );
    }
  }

  /**
   * Map Bybit symbol to normalized ExchangeSymbol
   */
  private mapToExchangeSymbol(bybitSymbol: BybitSymbolInfo): ExchangeSymbol {
    return {
      symbol: bybitSymbol.symbol,
      exchange: 'bybit',
      status: bybitSymbol.status,
      baseAsset: bybitSymbol.baseCoin,
      quoteAsset: bybitSymbol.quoteCoin,
      pricePrecision: bybitSymbol.priceScale,
      quantityPrecision: this.calculatePrecision(
        bybitSymbol.lotSizeFilter.qtyStep
      ),
      filters: {
        tickSize: bybitSymbol.priceFilter.tickSize,
        minQty: bybitSymbol.lotSizeFilter.minOrderQty,
        maxQty: bybitSymbol.lotSizeFilter.maxOrderQty,
      },
      contractType: bybitSymbol.contractType,
      metadata: {
        settleCoin: bybitSymbol.settleCoin,
      },
    };
  }

  /**
   * Calculate precision from step size
   */
  private calculatePrecision(stepSize: string): number {
    const parts = stepSize.split('.');
    if (parts.length === 1) return 0;
    return parts[1].length;
  }
}
