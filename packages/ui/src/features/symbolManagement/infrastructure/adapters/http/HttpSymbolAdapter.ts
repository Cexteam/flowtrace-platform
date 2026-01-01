/**
 * HttpSymbolAdapter - HTTP implementation of SymbolApiPort
 *
 * Implements SymbolApiPort for Cloud deployment using REST API calls.
 *
 */

import { injectable, inject } from 'inversify';
import { UI_CORE_TYPES } from '../../../../../shared/lib/di/core/types';
import type {
  SymbolApiPort,
  GetSymbolsRequest,
  GetSymbolsResponse,
} from '../../../application/ports/out/SymbolApiPort';
import type {
  Symbol,
  SymbolConfig,
  ExchangeMetadata,
  SymbolToggleResult,
  SymbolSyncResult,
} from '../../../domain/types';

/**
 * HTTP adapter for symbol API operations
 *
 * Makes REST API calls to the backend server for symbol management.
 */
@injectable()
export class HttpSymbolAdapter implements SymbolApiPort {
  private readonly baseUrl: string;

  constructor(@inject(UI_CORE_TYPES.ApiBaseUrl) apiBaseUrl: string) {
    this.baseUrl = apiBaseUrl;
  }

  /**
   * Get symbols with optional filtering
   */
  async getSymbols(request?: GetSymbolsRequest): Promise<GetSymbolsResponse> {
    const params = new URLSearchParams();
    if (request?.exchange) params.append('exchange', request.exchange);
    if (request?.status) params.append('status', request.status);
    if (request?.isStreaming !== undefined)
      params.append('isStreaming', request.isStreaming.toString());
    if (request?.isProcessing !== undefined)
      params.append('isProcessing', request.isProcessing.toString());
    if (request?.limit) params.append('limit', request.limit.toString());
    if (request?.offset) params.append('offset', request.offset.toString());

    const queryString = params.toString();
    const url = `${this.baseUrl}/symbols${
      queryString ? `?${queryString}` : ''
    }`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch symbols: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      symbols: data.symbols.map(this.mapSymbolFromApi),
      total: data.total,
    };
  }

  /**
   * Get a specific symbol by ID
   */
  async getSymbolById(symbolId: string): Promise<Symbol | null> {
    const response = await fetch(`${this.baseUrl}/symbols/${symbolId}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch symbol: ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapSymbolFromApi(data);
  }

  /**
   * Activate a symbol for data collection
   */
  async activateSymbol(symbolId: string): Promise<SymbolToggleResult> {
    const response = await fetch(
      `${this.baseUrl}/symbols/${symbolId}/activate`,
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
        symbolId,
        status: 'inactive',
        message:
          error.message || `Failed to activate symbol: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      symbolId,
      status: 'active',
      message: data.message,
    };
  }

  /**
   * Deactivate a symbol from data collection
   */
  async deactivateSymbol(symbolId: string): Promise<SymbolToggleResult> {
    const response = await fetch(
      `${this.baseUrl}/symbols/${symbolId}/deactivate`,
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
        symbolId,
        status: 'active',
        message:
          error.message ||
          `Failed to deactivate symbol: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      symbolId,
      status: 'inactive',
      message: data.message,
    };
  }

  /**
   * Trigger symbol sync for a specific exchange
   */
  async syncSymbols(exchange: string): Promise<SymbolSyncResult> {
    const response = await fetch(`${this.baseUrl}/symbols/sync/${exchange}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        exchange,
        symbolsAdded: 0,
        symbolsUpdated: 0,
        symbolsDelisted: 0,
        syncedAt: new Date(),
        message:
          error.message || `Failed to sync symbols: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      exchange,
      symbolsAdded: data.symbolsAdded,
      symbolsUpdated: data.symbolsUpdated,
      symbolsDelisted: data.symbolsDelisted,
      syncedAt: new Date(data.syncedAt),
      message: data.message,
    };
  }

  /**
   * Map API response to Symbol domain type
   */
  private mapSymbolFromApi(data: Record<string, unknown>): Symbol {
    const config = data.config as Record<string, unknown> | undefined;
    const exchangeMetadata = data.exchangeMetadata as Record<
      string,
      unknown
    > | null;

    return {
      id: data.id as string,
      symbol: data.symbol as string,
      exchange: data.exchange as string,
      baseAsset: data.baseAsset as string,
      quoteAsset: data.quoteAsset as string,
      status: data.status as Symbol['status'],
      enabledByAdmin: (data.enabledByAdmin as boolean) ?? true,
      isStreaming: data.isStreaming as boolean,
      isProcessing: data.isProcessing as boolean,
      config: {
        tickValue: (config?.tickValue as number) ?? 0,
        pricePrecision: (config?.pricePrecision as number) ?? 8,
        quantityPrecision: (config?.quantityPrecision as number) ?? 8,
      } as SymbolConfig,
      exchangeMetadata: exchangeMetadata as ExchangeMetadata | null,
      lastSyncAt: data.lastSyncAt ? new Date(data.lastSyncAt as string) : null,
      createdAt: new Date(data.createdAt as string),
      updatedAt: new Date(data.updatedAt as string),
    };
  }
}
