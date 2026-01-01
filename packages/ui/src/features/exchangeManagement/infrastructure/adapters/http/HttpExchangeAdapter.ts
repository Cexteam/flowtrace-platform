/**
 * HttpExchangeAdapter - HTTP implementation of ExchangeApiPort
 *
 * Implements ExchangeApiPort for Cloud deployment using REST API calls.
 *
 */

import { injectable, inject } from 'inversify';
import { UI_CORE_TYPES } from '../../../../../shared/lib/di/core/types';
import type {
  ExchangeApiPort,
  GetExchangesRequest,
  GetExchangesResponse,
} from '../../../application/ports/out/ExchangeApiPort';
import type {
  Exchange,
  ExchangeHealthCheck,
  ExchangeToggleResult,
  ExchangeFeatures,
  ExchangeSyncHistoryEntry,
} from '../../../domain/types';

/**
 * HTTP adapter for exchange API operations
 *
 * Makes REST API calls to the backend server for exchange management.
 */
@injectable()
export class HttpExchangeAdapter implements ExchangeApiPort {
  private readonly baseUrl: string;

  constructor(@inject(UI_CORE_TYPES.ApiBaseUrl) apiBaseUrl: string) {
    this.baseUrl = apiBaseUrl;
  }

  /**
   * Get all exchanges with optional filtering
   */
  async getExchanges(
    request?: GetExchangesRequest
  ): Promise<GetExchangesResponse> {
    const params = new URLSearchParams();
    if (request?.implementationStatus)
      params.append('implementationStatus', request.implementationStatus);
    if (request?.healthStatus)
      params.append('healthStatus', request.healthStatus);
    if (request?.isEnabled !== undefined)
      params.append('isEnabled', request.isEnabled.toString());
    if (request?.limit) params.append('limit', request.limit.toString());
    if (request?.offset) params.append('offset', request.offset.toString());

    const queryString = params.toString();
    const url = `${this.baseUrl}/exchanges${
      queryString ? `?${queryString}` : ''
    }`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch exchanges: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      exchanges: data.exchanges.map(this.mapExchangeFromApi),
      total: data.total,
    };
  }

  /**
   * Get health check status for a specific exchange
   */
  async getExchangeHealth(
    exchangeName: string
  ): Promise<ExchangeHealthCheck | null> {
    const response = await fetch(
      `${this.baseUrl}/exchanges/${exchangeName}/health`
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch exchange health: ${response.statusText}`
      );
    }

    const data = await response.json();
    return {
      status: data.status,
      latencyMs: data.latencyMs,
      lastCheckedAt: new Date(data.lastCheckedAt),
      errorMessage: data.errorMessage,
    };
  }

  /**
   * Enable an exchange for data collection
   */
  async enableExchange(exchangeName: string): Promise<ExchangeToggleResult> {
    const response = await fetch(
      `${this.baseUrl}/exchanges/${exchangeName}/enable`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        exchangeName,
        isEnabled: false,
        message:
          error.message || `Failed to enable exchange: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      exchangeName,
      isEnabled: true,
      message: data.message,
    };
  }

  /**
   * Disable an exchange from data collection
   */
  async disableExchange(exchangeName: string): Promise<ExchangeToggleResult> {
    const response = await fetch(
      `${this.baseUrl}/exchanges/${exchangeName}/disable`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        exchangeName,
        isEnabled: true,
        message:
          error.message || `Failed to disable exchange: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      exchangeName,
      isEnabled: false,
      message: data.message,
    };
  }

  /**
   * Map API response to Exchange domain type
   */
  private mapExchangeFromApi(data: Record<string, unknown>): Exchange {
    const features = data.features as Record<string, boolean> | undefined;
    const syncHistory = data.syncHistory as
      | Record<string, unknown>[]
      | undefined;

    return {
      name: data.name as string,
      displayName: data.displayName as string,
      implementationStatus:
        data.implementationStatus as Exchange['implementationStatus'],
      healthStatus: data.healthStatus as Exchange['healthStatus'],
      symbolCount: data.symbolCount as number,
      lastHealthCheck: data.lastHealthCheck
        ? new Date(data.lastHealthCheck as string)
        : null,
      isEnabled: data.isEnabled as boolean,
      features: {
        spotTrading: features?.spotTrading ?? false,
        futuresTrading: features?.futuresTrading ?? false,
        marginTrading: features?.marginTrading ?? false,
        websocketStreaming: features?.websocketStreaming ?? false,
        historicalData: features?.historicalData ?? false,
      } as ExchangeFeatures,
      apiStatus: data.apiStatus as Exchange['apiStatus'],
      syncHistory: (syncHistory || []).map(
        (entry): ExchangeSyncHistoryEntry => ({
          syncedAt: new Date(entry.syncedAt as string),
          symbolsAdded: entry.symbolsAdded as number,
          symbolsUpdated: entry.symbolsUpdated as number,
          symbolsDelisted: entry.symbolsDelisted as number,
          success: entry.success as boolean,
          errorMessage: entry.errorMessage as string | undefined,
        })
      ),
      createdAt: new Date(data.createdAt as string),
      updatedAt: new Date(data.updatedAt as string),
    };
  }
}
