import { injectable, inject } from 'inversify';
import axios, { AxiosInstance } from 'axios';
import {
  RestApiGapRecoveryPort,
  SyncStatistics,
  TradeRecord,
} from '../../application/ports/out/RestApiGapRecoveryPort.js';
import { EXCHANGE_MANAGEMENT_SYMBOLS } from '../../../../shared/lib/di/bindings/features/exchangeManagement/types.js';
import type { ExchangeRepository } from '../../../exchangeManagement/domain/repositories/ExchangeRepository.js';
import type { Exchange } from '../../../exchangeManagement/domain/entities/Exchange.js';
import { createLogger } from '../../../../shared/lib/logger/logger.js';

const logger = createLogger('BinanceRestApiGapRecoveryAdapter');

/**
 * Binance REST API Adapter for Gap Recovery
 *
 * Syncs missing trades via Binance Futures AggTrades REST API endpoint.
 * Exchange config (URLs, sync settings) loaded from database via ExchangeRepository.
 */
@injectable()
export class BinanceRestApiGapRecoveryAdapter
  implements RestApiGapRecoveryPort
{
  private axiosInstance: AxiosInstance | null = null;
  private syncStats: SyncStatistics;
  private exchangeConfig: Exchange | null = null;

  constructor(
    @inject(EXCHANGE_MANAGEMENT_SYMBOLS.ExchangeRepository)
    private exchangeRepository: ExchangeRepository
  ) {
    // Initialize stats
    this.syncStats = {
      totalSyncs: 0,
      totalTradesSynced: 0,
      rateLimitHits: 0,
      averageSyncDuration: 0,
      lastSyncTimestamp: 0,
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
        syncRestLimit: this.exchangeConfig.syncRestLimit,
      });
    }
    return this.exchangeConfig;
  }

  /**
   * Get or create axios instance (lazy initialization)
   */
  private async getAxiosInstance(): Promise<AxiosInstance> {
    if (!this.axiosInstance) {
      const config = await this.getExchangeConfig();

      this.axiosInstance = axios.create({
        baseURL: config.restUrl,
        timeout: 10000,
      });

      // Setup rate limiting
      this.setupRateLimiting(this.axiosInstance);
    }
    return this.axiosInstance;
  }

  /**
   * Sync missing trades between trade IDs using Binance AggTrades API
   */
  async syncMissingTrades(
    symbol: string,
    startId: number,
    endId: number
  ): Promise<TradeRecord[]> {
    const startTime = Date.now();

    try {
      this.syncStats.totalSyncs++;

      const config = await this.getExchangeConfig();
      const axiosInstance = await this.getAxiosInstance();

      // Use fromId approach for trade ID range queries
      const params: any = {
        symbol: symbol.toUpperCase(),
        fromId: startId + 1, // Exclusive start
        limit: config.syncRestLimit, // From database config
      };

      const response = await axiosInstance.get('/fapi/v1/aggTrades', {
        params,
      });

      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }

      // Convert Binance response to TradeRecord format
      const trades: TradeRecord[] = response.data
        .filter((tradeData: any) => {
          // Filter within our range (extra safety)
          return tradeData.a > startId && tradeData.a <= endId;
        })
        .map(this.convertApiResponseToTradeRecord.bind(this));

      const duration = Date.now() - startTime;
      this.syncStats.totalTradesSynced += trades.length;
      this.syncStats.averageSyncDuration =
        (this.syncStats.averageSyncDuration * (this.syncStats.totalSyncs - 1) +
          duration) /
        this.syncStats.totalSyncs;
      this.syncStats.lastSyncTimestamp = Date.now();

      logger.info(
        `Synced ${trades.length} trades for ${symbol} (${duration}ms)`
      );

      return trades;
    } catch (error: any) {
      logger.error(`Gap recovery failed for ${symbol}:`, error.message);

      if (error.response?.status === 429) {
        // Rate limit
        this.syncStats.rateLimitHits++;
      }

      return []; // Return empty on failure
    }
  }

  /**
   * Check if REST API is available (basic connectivity check)
   */
  async isAvailable(): Promise<boolean> {
    try {
      const axiosInstance = await this.getAxiosInstance();
      const response = await axiosInstance.get('/fapi/v1/exchangeInfo');
      return response.status === 200;
    } catch (error) {
      logger.error('Binance REST API availability check failed:', error);
      return false;
    }
  }

  /**
   * Get rate limit info from response headers
   */
  async getRateLimitInfo(): Promise<{ remaining: number; resetTime: number }> {
    try {
      const axiosInstance = await this.getAxiosInstance();
      const response = await axiosInstance.get('/fapi/v1/exchangeInfo');

      return {
        remaining: parseInt(
          response.headers['x-mbx-used-weight-1m'] || '1000',
          10
        ),
        resetTime: Date.now() + 60000, // Default 1 minute window
      };
    } catch (error) {
      return { remaining: 0, resetTime: Date.now() + 60000 };
    }
  }

  /**
   * Get current sync statistics
   */
  async getSyncStatistics(): Promise<SyncStatistics> {
    return { ...this.syncStats };
  }

  /**
   * Setup rate limiting with request delays
   */
  private setupRateLimiting(axiosInstance: AxiosInstance): void {
    let lastRequestTime = 0;
    const minRequestInterval = 100; // 100ms between requests

    axiosInstance.interceptors.request.use(async (config) => {
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;

      if (timeSinceLastRequest < minRequestInterval) {
        await new Promise((resolve) =>
          setTimeout(resolve, minRequestInterval - timeSinceLastRequest)
        );
      }

      lastRequestTime = Date.now();
      return config;
    });
  }

  /**
   * Convert Binance API response to TradeRecord format
   */
  private convertApiResponseToTradeRecord(apiResponse: any): TradeRecord {
    return {
      e: 'trade', // Event type
      E: apiResponse.T, // Event time (same as trade time)
      T: apiResponse.T, // Trade timestamp
      s: apiResponse.s?.toUpperCase() || '', // Symbol
      t: apiResponse.a, // Aggregate trade ID
      p: apiResponse.p, // Price string
      q: apiResponse.q, // Quantity string
      X: 'MARKET', // Assume market order
      m: apiResponse.m, // Is buyer maker
    };
  }
}
