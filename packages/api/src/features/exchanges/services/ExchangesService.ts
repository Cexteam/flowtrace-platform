/**
 * ExchangesService - Shared service for HTTP and IPC
 *
 * This service provides exchange management operations that can be used
 * by both HTTP controllers and IPC handlers.
 *
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { BRIDGE_TOKENS } from '../../../bridge/index.js';
import type {
  ExchangeManagementPort,
  Exchange,
  ExchangeFilter,
  SymbolManagementPort,
} from '@flowtrace/core';
import type {
  ExchangeResponseDto,
  ExchangeListResponseDto,
  ExchangeHealthResponseDto,
  ExchangeToggleResponseDto,
  ImplementationStatus,
} from '../presentation/dto/index.js';

/**
 * Extended filter options for exchanges with pagination
 */
export interface ExchangesFilter extends ExchangeFilter {
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'name' | 'enabled' | 'healthStatus';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response for exchanges
 */
export interface PaginatedExchangesResponse {
  exchanges: ExchangeResponseDto[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

@Injectable()
export class ExchangesService {
  constructor(
    @Inject(BRIDGE_TOKENS.EXCHANGE_MANAGEMENT_PORT)
    private readonly exchangeManagementPort: ExchangeManagementPort | null,

    @Optional()
    @Inject(BRIDGE_TOKENS.SYMBOL_MANAGEMENT_PORT)
    private readonly symbolManagementPort: SymbolManagementPort | null
  ) {
    console.log(
      '[ExchangesService] Initialized with symbolManagementPort:',
      !!this.symbolManagementPort
    );
  }

  /**
   * Ensure the port is available, throw if not
   */
  private getPort(): ExchangeManagementPort {
    if (!this.exchangeManagementPort) {
      throw new Error('Exchange management service not available');
    }
    return this.exchangeManagementPort;
  }

  /**
   * Get symbol count for an exchange
   */
  private async getSymbolCountForExchange(
    exchangeName: string
  ): Promise<number> {
    if (!this.symbolManagementPort) {
      console.log(
        '[ExchangesService] symbolManagementPort is null, returning 0'
      );
      return 0;
    }
    try {
      console.log(
        '[ExchangesService] Getting symbols for exchange:',
        exchangeName
      );
      const symbols = await this.symbolManagementPort.getSymbols({
        exchange: exchangeName as any,
      });
      console.log(
        `[ExchangesService] Found ${symbols.length} symbols for ${exchangeName}`
      );
      return symbols.length;
    } catch (error) {
      console.error('[ExchangesService] Error getting symbols:', error);
      return 0;
    }
  }

  /**
   * Transform core Exchange entity to API response DTO
   */
  private toExchangeResponseDto(
    exchange: Exchange,
    symbolCount: number
  ): ExchangeResponseDto {
    const json = exchange.toJSON();
    return {
      name: json.id,
      implementationStatus: json.implementationStatus as ImplementationStatus,
      healthStatus: exchange.isOperational(),
      symbolCount,
      enabled: json.enabled,
      lastHealthCheck:
        json.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  /**
   * Get all exchanges with optional filtering and pagination
   */
  async getExchanges(
    filter?: ExchangesFilter
  ): Promise<ExchangeListResponseDto | PaginatedExchangesResponse> {
    const port = this.getPort();
    const {
      search,
      page,
      pageSize = 25,
      sortBy = 'name',
      sortOrder = 'asc',
      ...coreFilter
    } = filter || {};

    const exchanges = await port.getExchanges(coreFilter);

    // Get symbol counts for all exchanges in parallel
    const symbolCounts = await Promise.all(
      exchanges.map((e) => this.getSymbolCountForExchange(e.id))
    );

    let exchangeDtos = exchanges.map((exchange, index) =>
      this.toExchangeResponseDto(exchange, symbolCounts[index])
    );

    // Apply search filter (case-insensitive)
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      exchangeDtos = exchangeDtos.filter((e) =>
        e.name.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    exchangeDtos.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'enabled':
          comparison = (a.enabled ? 1 : 0) - (b.enabled ? 1 : 0);
          break;
        case 'healthStatus':
          comparison = (a.healthStatus ? 1 : 0) - (b.healthStatus ? 1 : 0);
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // If page is provided and > 0, use new pagination format (1-based indexing)
    if (page !== undefined && page > 0) {
      const totalCount = exchangeDtos.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const startIndex = (page - 1) * pageSize;
      const paginatedExchanges = exchangeDtos.slice(
        startIndex,
        startIndex + pageSize
      );

      return {
        exchanges: paginatedExchanges,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
        },
      };
    }

    // Legacy response format (no pagination or page = 0)
    return {
      exchanges: exchangeDtos,
      total: exchangeDtos.length,
    };
  }

  /**
   * Get exchange by ID
   */
  async getExchangeById(
    exchangeId: string
  ): Promise<ExchangeResponseDto | null> {
    const port = this.getPort();
    const exchange = await port.getExchangeById(exchangeId);

    if (!exchange) {
      return null;
    }

    const symbolCount = await this.getSymbolCountForExchange(exchangeId);
    return this.toExchangeResponseDto(exchange, symbolCount);
  }

  /**
   * Get health status of an exchange
   */
  async getExchangeHealth(
    exchangeId: string
  ): Promise<ExchangeHealthResponseDto> {
    const port = this.getPort();
    const health = await port.getExchangeHealth(exchangeId);

    return {
      name: health.exchangeId,
      isHealthy: health.isHealthy,
      checkedAt:
        health.lastCheckedAt?.toISOString() ?? new Date().toISOString(),
      latencyMs: health.latencyMs,
      error: health.error,
    };
  }

  /**
   * Enable an exchange
   */
  async enableExchange(exchangeId: string): Promise<ExchangeToggleResponseDto> {
    const port = this.getPort();
    const exchange = await port.enableExchange(exchangeId);

    return {
      success: true,
      exchange: exchange.id,
      enabled: true,
      message: `Exchange ${exchange.displayName} enabled successfully`,
    };
  }

  /**
   * Disable an exchange
   */
  async disableExchange(
    exchangeId: string
  ): Promise<ExchangeToggleResponseDto> {
    const port = this.getPort();
    const exchange = await port.disableExchange(exchangeId);

    return {
      success: true,
      exchange: exchange.id,
      enabled: false,
      message: `Exchange ${exchange.displayName} disabled successfully`,
    };
  }
}
