/**
 * Test Exchange Connection Use Case
 *
 * Tests connectivity to exchange APIs and handles various response scenarios.
 * Implements the TestExchangeConnectionPort interface.
 *
 * Hexagonal Architecture: This is the application core
 * - Implements the inbound port (TestExchangeConnectionPort)
 * - Uses outbound ports (ExchangeConfigRepository, ExchangeApiClient)
 * - Contains business logic for testing exchange connectivity
 */

import { inject, injectable } from 'inversify';
import type { ExchangeRepository } from '../../../domain/repositories/ExchangeRepository.js';
import type { ExchangeApiClient } from '../../ports/out/ExchangeApiClient.js';
import type {
  TestExchangeConnectionRequest,
  TestExchangeConnectionResponse,
} from './DTO.js';
import { EXCHANGE_MANAGEMENT_SYMBOLS } from '../../../../../shared/lib/di/bindings/features/exchangeManagement/types.js';

@injectable()
export class TestExchangeConnectionUseCase {
  constructor(
    @inject(EXCHANGE_MANAGEMENT_SYMBOLS.ExchangeRepository)
    private readonly exchangeRepository: ExchangeRepository,
    @inject(EXCHANGE_MANAGEMENT_SYMBOLS.ExchangeApiClientFactory)
    private readonly exchangeApiClientFactory: any // Factory to create API clients
  ) {}

  async execute(
    request: TestExchangeConnectionRequest
  ): Promise<TestExchangeConnectionResponse> {
    const startTime = Date.now();

    try {
      // Get exchange configuration if using stored credentials
      let config = null;
      if (request.useStoredCredentials) {
        config = await this.exchangeRepository.findById(request.exchangeId);
        if (!config) {
          return this.createErrorResponse(
            request.exchangeId,
            'Exchange configuration not found',
            startTime
          );
        }
      }

      // Create API client for the exchange
      const apiClient = await this.createApiClient(request, config);
      if (!apiClient) {
        return this.createErrorResponse(
          request.exchangeId,
          'Failed to create API client',
          startTime
        );
      }

      // Perform health check
      const isHealthy = await apiClient.healthCheck();
      const responseTime = Date.now() - startTime;

      if (!isHealthy) {
        return this.createErrorResponse(
          request.exchangeId,
          'Health check failed',
          startTime,
          responseTime
        );
      }

      return {
        exchangeId: request.exchangeId,
        success: true,
        latencyMs: responseTime,
        testedAt: new Date(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return this.createErrorResponse(
        request.exchangeId,
        errorMessage,
        startTime,
        responseTime
      );
    }
  }

  private async createApiClient(
    request: TestExchangeConnectionRequest,
    config: any
  ): Promise<ExchangeApiClient | null> {
    try {
      // Use provided credentials or stored credentials
      const apiKey = request.apiKey || config?.apiKey;
      const apiSecret = request.apiSecret || config?.apiSecret;

      // Create client configuration
      const clientConfig = {
        exchange: request.exchangeId,
        apiKey,
        apiSecret,
        restUrl: config?.restUrl,
        rateLimitPerMinute: config?.rateLimitPerMinute,
      };

      // Use factory to create appropriate client
      return await this.exchangeApiClientFactory.create(clientConfig);
    } catch (error) {
      console.error(
        `Failed to create API client for ${request.exchangeId}:`,
        error
      );
      return null;
    }
  }

  private createErrorResponse(
    exchangeId: string,
    error: string,
    startTime: number,
    responseTime?: number
  ): TestExchangeConnectionResponse {
    return {
      exchangeId,
      success: false,
      error,
      latencyMs: responseTime || Date.now() - startTime,
      testedAt: new Date(),
    };
  }
}
