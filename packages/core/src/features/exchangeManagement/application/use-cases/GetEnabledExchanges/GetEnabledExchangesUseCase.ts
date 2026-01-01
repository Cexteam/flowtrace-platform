/**
 * Get Enabled Exchanges Use Case
 *
 * Retrieves all enabled exchange configurations.
 * Provides fallback configurations for critical exchanges if none are enabled.
 *
 * Hexagonal Architecture: This is the application core
 * - Implements the inbound port (GetEnabledExchangesPort)
 * - Uses outbound ports (ExchangeConfigRepository)
 * - Contains business logic for retrieving enabled exchanges
 */

import { inject, injectable } from 'inversify';
import type { ExchangeRepository } from '../../../domain/repositories/ExchangeRepository.js';
// Port interface should be defined in application/ports/in/
import type {
  GetEnabledExchangesRequest,
  GetEnabledExchangesResponse,
} from './DTO.js';
import { Exchange } from '../../../domain/entities/Exchange.js';
import { EXCHANGE_MANAGEMENT_SYMBOLS } from '../../../../../shared/lib/di/bindings/features/exchangeManagement/types.js';

@injectable()
export class GetEnabledExchangesUseCase {
  constructor(
    @inject(EXCHANGE_MANAGEMENT_SYMBOLS.ExchangeRepository)
    private readonly exchangeRepository: ExchangeRepository
  ) {}

  async execute(
    _request: GetEnabledExchangesRequest
  ): Promise<GetEnabledExchangesResponse> {
    try {
      const enabledExchanges = await this.exchangeRepository.findEnabled();

      // If we have enabled exchanges, return them
      if (enabledExchanges.length > 0) {
        return {
          exchanges: enabledExchanges,
          count: enabledExchanges.length,
          hasFallbacks: false,
        };
      }

      // No enabled exchanges - provide fallback configurations
      const fallbackExchanges = this.createFallbackConfigurations();

      return {
        exchanges: fallbackExchanges,
        count: fallbackExchanges.length,
        hasFallbacks: true,
      };
    } catch (error) {
      console.error('Failed to get enabled exchanges:', error);

      // On error, return fallback configurations
      const fallbackExchanges = this.createFallbackConfigurations();

      return {
        exchanges: fallbackExchanges,
        count: fallbackExchanges.length,
        hasFallbacks: true,
      };
    }
  }

  private createFallbackConfigurations(): Exchange[] {
    const criticalExchanges = ['binance', 'bybit', 'okx'];

    return criticalExchanges.map((exchangeId) =>
      Exchange.create({
        id: exchangeId,
        displayName: this.getDisplayName(exchangeId),
        wsUrl: this.getDefaultWsUrl(exchangeId),
        restUrl: this.getDefaultRestUrl(exchangeId),
        rateLimitPerMinute: this.getDefaultRateLimit(exchangeId),
        implementationStatus: 'implemented',
        enabled: true, // Fallbacks are considered enabled
      })
    );
  }

  private getDisplayName(exchangeId: string): string {
    const names: Record<string, string> = {
      binance: 'Binance',
      bybit: 'Bybit',
      okx: 'OKX',
    };
    return names[exchangeId] || exchangeId;
  }

  private getDefaultWsUrl(exchangeId: string): string {
    const defaults: Record<string, string> = {
      binance: 'wss://stream.binance.com:9443/ws',
      bybit: 'wss://stream.bybit.com/v5/public/spot',
      okx: 'wss://ws.okx.com:8443/ws/v5/public',
    };
    return defaults[exchangeId] || '';
  }

  private getDefaultRestUrl(exchangeId: string): string {
    const defaults: Record<string, string> = {
      binance: 'https://api.binance.com',
      bybit: 'https://api.bybit.com',
      okx: 'https://www.okx.com',
    };
    return defaults[exchangeId] || '';
  }

  private getDefaultRateLimit(exchangeId: string): number {
    const defaults: Record<string, number> = {
      binance: 1200,
      bybit: 600,
      okx: 600,
    };
    return defaults[exchangeId] || 1200;
  }
}
