/**
 * Binance Exchange API Adapter
 *
 * Implements ExchangeApiClient for Binance Futures API.
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

const logger = createLogger('BinanceExchangeApiAdapter');

interface BinanceSymbolInfo {
  symbol: string;
  status: 'TRADING' | 'BREAK' | 'HALT';
  baseAsset: string;
  quoteAsset: string;
  pricePrecision: number;
  quantityPrecision: number;
  filters: Array<{
    filterType: string;
    [key: string]: any;
  }>;
  contractType?: string;
  marginAsset?: string;
  underlyingType?: string;
}

interface BinanceExchangeInfo {
  timezone: string;
  serverTime: number;
  symbols: BinanceSymbolInfo[];
}

@injectable()
export class BinanceExchangeApiAdapter implements ExchangeApiClient {
  private exchangeConfig: Exchange | null = null;
  private cache: {
    exchangeInfo?: BinanceExchangeInfo;
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
      this.exchangeConfig = await this.exchangeRepository.findById('binance');
      if (!this.exchangeConfig) {
        throw new Error('Binance exchange config not found in database');
      }
      logger.info('Loaded Binance config from database', {
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
    return 'binance' as const;
  }

  /**
   * Fetch all active USDT symbols from Binance
   */
  async fetchSymbols(): Promise<ExchangeSymbol[]> {
    try {
      // Check cache
      if (this.cache.exchangeInfo && this.cache.lastFetch) {
        const age = Date.now() - this.cache.lastFetch;
        if (age < this.cache.ttl) {
          logger.debug('Returning cached symbols', { age });
          return this.getActiveUSDTSymbols(this.cache.exchangeInfo);
        }
      }

      logger.debug('Fetching active symbols from Binance');

      const exchangeInfo = await this.fetchExchangeInfo();
      const symbols = this.getActiveUSDTSymbols(exchangeInfo);

      logger.info(`Fetched ${symbols.length} active symbols from Binance`);
      return symbols;
    } catch (error: any) {
      logger.error('Failed to fetch active symbols from Binance:', error);

      // Return cached data if available
      if (this.cache.exchangeInfo) {
        logger.warn('Returning stale cached data due to API error');
        return this.getActiveUSDTSymbols(this.cache.exchangeInfo);
      }

      throw new ExchangeApiError(
        'binance',
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
      logger.debug(`Fetching symbol info for ${symbol} from Binance`);

      const exchangeInfo = await this.fetchExchangeInfo();
      const binanceSymbol = exchangeInfo.symbols.find(
        (s) => s.symbol === symbol
      );

      if (!binanceSymbol) {
        return null;
      }

      return this.mapToExchangeSymbol(binanceSymbol);
    } catch (error: any) {
      logger.error(`Failed to fetch symbol info for ${symbol}:`, error);
      throw new ExchangeApiError(
        'binance',
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
      const response = await fetch(`${baseUrl}/fapi/v1/ping`);
      return response.ok;
    } catch (error) {
      logger.error('Binance health check failed:', error);
      return false;
    }
  }

  /**
   * Get rate limits
   */
  getRateLimits() {
    return {
      requestsPerMinute: 1200,
      requestsPerSecond: 20,
    };
  }

  /**
   * Fetch current prices for all symbols
   * Uses /fapi/v1/ticker/price endpoint
   */
  async fetchPrices(): Promise<Map<string, number>> {
    try {
      const baseUrl = await this.getBaseUrl();
      logger.debug('Fetching prices from Binance');

      const response = await fetch(`${baseUrl}/fapi/v1/ticker/price`);

      if (!response.ok) {
        throw new Error(
          `Binance API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as Array<{
        symbol: string;
        price: string;
        time: number;
      }>;

      const priceMap = new Map<string, number>();
      for (const item of data) {
        priceMap.set(item.symbol, parseFloat(item.price));
      }

      logger.info(`Fetched ${priceMap.size} prices from Binance`);
      return priceMap;
    } catch (error: any) {
      logger.error('Failed to fetch prices from Binance:', error);
      throw new ExchangeApiError(
        'binance',
        error.statusCode,
        'Failed to fetch prices',
        error
      );
    }
  }

  /**
   * Fetch exchange info from Binance API
   * Cached for 5 minutes to avoid rate limits
   */
  private async fetchExchangeInfo(
    forceRefresh = false
  ): Promise<BinanceExchangeInfo> {
    // Check cache
    if (!forceRefresh && this.cache.exchangeInfo && this.cache.lastFetch) {
      const age = Date.now() - this.cache.lastFetch;
      if (age < this.cache.ttl) {
        logger.debug('Returning cached exchange info', { age });
        return this.cache.exchangeInfo;
      }
    }

    // Fetch from API
    try {
      const baseUrl = await this.getBaseUrl();
      logger.info('Fetching exchange info from Binance API');
      const response = await fetch(`${baseUrl}/fapi/v1/exchangeInfo`);

      if (!response.ok) {
        throw new Error(
          `Binance API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as BinanceExchangeInfo;

      // Update cache
      this.cache.exchangeInfo = data;
      this.cache.lastFetch = Date.now();

      logger.info(`Fetched ${data.symbols.length} symbols from Binance`);
      return data;
    } catch (error) {
      logger.error('Failed to fetch exchange info from Binance:', error);

      // Return cached data if available
      if (this.cache.exchangeInfo) {
        logger.warn('Returning stale cached data due to API error');
        return this.cache.exchangeInfo;
      }

      throw error;
    }
  }

  /**
   * Get active USDT trading pairs from exchange info
   */
  private getActiveUSDTSymbols(
    exchangeInfo: BinanceExchangeInfo
  ): ExchangeSymbol[] {
    return exchangeInfo.symbols
      .filter((s) => s.status === 'TRADING' && s.quoteAsset === 'USDT')
      .map((s) => this.mapToExchangeSymbol(s));
  }

  /**
   * Map Binance symbol to normalized ExchangeSymbol
   */
  private mapToExchangeSymbol(
    binanceSymbol: BinanceSymbolInfo
  ): ExchangeSymbol {
    // Extract filters
    const priceFilter = binanceSymbol.filters.find(
      (f: any) => f.filterType === 'PRICE_FILTER'
    );
    const lotSizeFilter = binanceSymbol.filters.find(
      (f: any) => f.filterType === 'LOT_SIZE'
    );
    const minNotionalFilter = binanceSymbol.filters.find(
      (f: any) => f.filterType === 'MIN_NOTIONAL'
    );

    return {
      symbol: binanceSymbol.symbol,
      exchange: 'binance',
      status: binanceSymbol.status,
      baseAsset: binanceSymbol.baseAsset,
      quoteAsset: binanceSymbol.quoteAsset,
      pricePrecision: binanceSymbol.pricePrecision,
      quantityPrecision: binanceSymbol.quantityPrecision,
      filters: {
        tickSize: priceFilter?.tickSize,
        minQty: lotSizeFilter?.minQty,
        maxQty: lotSizeFilter?.maxQty,
        minNotional: minNotionalFilter?.notional,
      },
      contractType: binanceSymbol.contractType,
      metadata: {
        marginAsset: binanceSymbol.marginAsset,
        underlyingType: binanceSymbol.underlyingType,
      },
    };
  }
}
