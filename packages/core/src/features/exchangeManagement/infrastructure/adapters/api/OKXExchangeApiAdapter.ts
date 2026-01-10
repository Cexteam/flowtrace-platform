/**
 * OKX Exchange API Adapter
 *
 * Implements ExchangeApiClient for OKX Futures API.
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

const logger = createLogger('OKXExchangeApiAdapter');

interface OKXInstrumentInfo {
  instId: string;
  instType: 'SWAP' | 'FUTURES' | 'OPTION';
  state: 'live' | 'suspend' | 'expired' | 'preopen';
  baseCcy: string;
  quoteCcy: string;
  settleCcy: string;
  tickSz: string;
  lotSz: string;
  minSz: string;
  ctVal: string;
  ctMult: string;
}

interface OKXInstrumentsResponse {
  code: string;
  msg: string;
  data: OKXInstrumentInfo[];
}

@injectable()
export class OKXExchangeApiAdapter implements ExchangeApiClient {
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
      this.exchangeConfig = await this.exchangeRepository.findById('okx');
      if (!this.exchangeConfig) {
        throw new Error('OKX exchange config not found in database');
      }
      logger.info('Loaded OKX config from database', {
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
    return 'okx' as const;
  }

  /**
   * Fetch all active USDT symbols from OKX
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

      logger.debug('Fetching active symbols from OKX');

      const baseUrl = await this.getBaseUrl();

      // Fetch SWAP (perpetual) instruments
      const response = await fetch(
        `${baseUrl}/api/v5/public/instruments?instType=SWAP`
      );

      if (!response.ok) {
        throw new Error(
          `OKX API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as OKXInstrumentsResponse;

      if (data.code !== '0') {
        throw new Error(`OKX API error: ${data.msg}`);
      }

      // Filter USDT perpetuals and map to ExchangeSymbol
      const symbols = data.data
        .filter(
          (s) =>
            s.state === 'live' &&
            s.settleCcy === 'USDT' &&
            s.instType === 'SWAP'
        )
        .map((s) => this.mapToExchangeSymbol(s));

      // Update cache
      this.cache.symbols = symbols;
      this.cache.lastFetch = Date.now();

      logger.info(`Fetched ${symbols.length} active symbols from OKX`);
      return symbols;
    } catch (error: any) {
      logger.error('Failed to fetch active symbols from OKX:', error);

      // Return cached data if available
      if (this.cache.symbols) {
        logger.warn('Returning stale cached data due to API error');
        return this.cache.symbols;
      }

      throw new ExchangeApiError(
        'okx',
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
      logger.debug(`Fetching symbol info for ${symbol} from OKX`);

      const baseUrl = await this.getBaseUrl();

      // OKX uses different format: BTC-USDT-SWAP
      const instId = this.toOKXFormat(symbol);

      const response = await fetch(
        `${baseUrl}/api/v5/public/instruments?instType=SWAP&instId=${instId}`
      );

      if (!response.ok) {
        throw new Error(
          `OKX API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as OKXInstrumentsResponse;

      if (data.code !== '0') {
        throw new Error(`OKX API error: ${data.msg}`);
      }

      const okxSymbol = data.data[0];

      if (!okxSymbol) {
        return null;
      }

      return this.mapToExchangeSymbol(okxSymbol);
    } catch (error: any) {
      logger.error(`Failed to fetch symbol info for ${symbol}:`, error);
      throw new ExchangeApiError(
        'okx',
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
      const response = await fetch(`${baseUrl}/api/v5/public/time`);
      return response.ok;
    } catch (error) {
      logger.error('OKX health check failed:', error);
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
   * Uses /api/v5/market/tickers endpoint
   */
  async fetchPrices(): Promise<Map<string, number>> {
    try {
      const baseUrl = await this.getBaseUrl();
      logger.debug('Fetching prices from OKX');

      const response = await fetch(
        `${baseUrl}/api/v5/market/tickers?instType=SWAP`
      );

      if (!response.ok) {
        throw new Error(
          `OKX API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as {
        code: string;
        msg: string;
        data: Array<{
          instId: string;
          last: string;
        }>;
      };

      if (data.code !== '0') {
        throw new Error(`OKX API error: ${data.msg}`);
      }

      const priceMap = new Map<string, number>();
      for (const item of data.data) {
        // Convert OKX format (BTC-USDT-SWAP) to standard format (BTCUSDT)
        const symbol = this.toStandardFormat(item.instId);
        priceMap.set(symbol, parseFloat(item.last));
      }

      logger.info(`Fetched ${priceMap.size} prices from OKX`);
      return priceMap;
    } catch (error: any) {
      logger.error('Failed to fetch prices from OKX:', error);
      throw new ExchangeApiError(
        'okx',
        error.statusCode,
        'Failed to fetch prices',
        error
      );
    }
  }

  /**
   * Map OKX instrument to normalized ExchangeSymbol
   */
  private mapToExchangeSymbol(
    okxInstrument: OKXInstrumentInfo
  ): ExchangeSymbol {
    // Convert OKX format (BTC-USDT-SWAP) to standard format (BTCUSDT)
    const symbol = this.toStandardFormat(okxInstrument.instId);

    return {
      symbol,
      exchange: 'okx',
      status: okxInstrument.state,
      baseAsset: okxInstrument.baseCcy,
      quoteAsset: okxInstrument.quoteCcy,
      pricePrecision: this.calculatePrecision(okxInstrument.tickSz),
      quantityPrecision: this.calculatePrecision(okxInstrument.lotSz),
      filters: {
        tickSize: okxInstrument.tickSz,
        minQty: okxInstrument.minSz,
        maxQty: undefined, // OKX doesn't provide max qty
      },
      contractType: okxInstrument.instType,
      metadata: {
        instId: okxInstrument.instId,
        settleCcy: okxInstrument.settleCcy,
        ctVal: okxInstrument.ctVal,
        ctMult: okxInstrument.ctMult,
      },
    };
  }

  /**
   * Convert standard format (BTCUSDT) to OKX format (BTC-USDT-SWAP)
   */
  private toOKXFormat(symbol: string): string {
    // Simple heuristic: assume USDT quote
    const base = symbol.replace('USDT', '');
    return `${base}-USDT-SWAP`;
  }

  /**
   * Convert OKX format (BTC-USDT-SWAP) to standard format (BTCUSDT)
   */
  private toStandardFormat(instId: string): string {
    // Remove -SWAP suffix and dashes
    return instId.replace('-SWAP', '').replace(/-/g, '');
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
