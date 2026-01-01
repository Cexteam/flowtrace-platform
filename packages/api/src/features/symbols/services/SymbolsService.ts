/**
 * SymbolsService - Shared service for HTTP and IPC
 *
 * This service provides symbol management operations that can be used
 * by both HTTP controllers and IPC handlers.
 *
 */

import { Injectable, Inject } from '@nestjs/common';
import { BRIDGE_TOKENS } from '../../../bridge/index.js';
import type {
  SymbolManagementPort,
  Symbol,
  ExchangeMetadata,
} from '@flowtrace/core';
import type {
  SymbolResponseDto,
  SymbolListResponseDto,
  SymbolActivationResponseDto,
  ValidExchange,
  ValidSymbolStatus,
} from '../presentation/dto/index.js';
import { VALID_EXCHANGES } from '../presentation/dto/index.js';

/**
 * Filter options for getting symbols
 */
export interface SymbolsFilter {
  exchange?: ValidExchange;
  status?: ValidSymbolStatus;
  enabledByAdmin?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
  sortBy?: 'symbol' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response for symbols
 */
export interface PaginatedSymbolsResponse {
  symbols: SymbolResponseDto[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

/**
 * Extract base asset from exchange metadata
 * Each exchange uses different field names
 */
function getBaseAsset(metadata: ExchangeMetadata | null): string | undefined {
  if (!metadata) return undefined;

  switch (metadata.exchange) {
    case 'binance':
      return metadata.baseAsset;
    case 'bybit':
      return metadata.baseCoin;
    case 'okx':
      return metadata.baseCcy;
    case 'kraken':
      return metadata.base;
    case 'coinbase':
      return metadata.baseCurrency;
    default:
      return undefined;
  }
}

/**
 * Extract quote asset from exchange metadata
 * Each exchange uses different field names
 */
function getQuoteAsset(metadata: ExchangeMetadata | null): string | undefined {
  if (!metadata) return undefined;

  switch (metadata.exchange) {
    case 'binance':
      return metadata.quoteAsset;
    case 'bybit':
      return metadata.quoteCoin;
    case 'okx':
      return metadata.quoteCcy;
    case 'kraken':
      return metadata.quote;
    case 'coinbase':
      return metadata.quoteCurrency;
    default:
      return undefined;
  }
}

/**
 * Transform core Symbol entity to API response DTO
 */
function toSymbolResponseDto(symbol: Symbol): SymbolResponseDto {
  const json = symbol.toJSON();
  return {
    id: json.id,
    symbol: json.symbol,
    exchange: json.exchange,
    status: json.status,
    baseAsset: getBaseAsset(json.exchangeMetadata),
    quoteAsset: getQuoteAsset(json.exchangeMetadata),
    pricePrecision: json.config?.pricePrecision,
    quantityPrecision: json.config?.quantityPrecision,
    enabled: json.enabledByAdmin,
    createdAt: json.createdAt.toISOString(),
    updatedAt: json.updatedAt.toISOString(),
  };
}

@Injectable()
export class SymbolsService {
  constructor(
    @Inject(BRIDGE_TOKENS.SYMBOL_MANAGEMENT_PORT)
    private readonly symbolManagementPort: SymbolManagementPort | null
  ) {}

  /**
   * Ensure the port is available, throw if not
   */
  private getPort(): SymbolManagementPort {
    if (!this.symbolManagementPort) {
      throw new Error('Symbol management service not available');
    }
    return this.symbolManagementPort;
  }

  /**
   * Get all symbols with optional filtering and pagination
   */
  async getSymbols(
    filter?: SymbolsFilter
  ): Promise<SymbolListResponseDto | PaginatedSymbolsResponse> {
    const {
      exchange,
      status,
      enabledByAdmin,
      search,
      limit = 2000,
      offset = 0,
      page,
      pageSize = 25,
      sortBy = 'symbol',
      sortOrder = 'asc',
    } = filter || {};
    const port = this.getPort();

    console.log('[SymbolsService] getSymbols called with filter:', filter);

    // Delegate to port - convert exchange string to Exchange type if provided
    const exchangeFilter =
      exchange && VALID_EXCHANGES.includes(exchange)
        ? (exchange as ValidExchange)
        : undefined;

    console.log('[SymbolsService] Calling port.getSymbols with:', {
      exchange: exchangeFilter,
      status,
      enabledByAdmin,
    });

    const symbols = await port.getSymbols({
      exchange: exchangeFilter,
      status,
      enabledByAdmin,
    });

    console.log(
      '[SymbolsService] port.getSymbols returned:',
      symbols.length,
      'symbols'
    );

    // Transform to response DTOs
    let symbolDtos = symbols.map(toSymbolResponseDto);

    // Apply search filter (case-insensitive)
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      symbolDtos = symbolDtos.filter(
        (s) =>
          s.symbol.toLowerCase().includes(searchLower) ||
          s.baseAsset?.toLowerCase().includes(searchLower) ||
          s.quoteAsset?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    symbolDtos.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'createdAt':
          comparison =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          comparison =
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        default:
          comparison = a.symbol.localeCompare(b.symbol);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // If page is provided, use new pagination format
    if (page !== undefined) {
      const totalCount = symbolDtos.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const startIndex = (page - 1) * pageSize;
      const paginatedSymbols = symbolDtos.slice(
        startIndex,
        startIndex + pageSize
      );

      console.log('[SymbolsService] Returning paginated response:', {
        symbolsCount: paginatedSymbols.length,
        totalCount,
        page,
        pageSize,
      });

      return {
        symbols: paginatedSymbols,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
        },
      };
    }

    // Legacy pagination (offset/limit)
    const paginatedSymbols = symbolDtos.slice(offset, offset + limit);

    console.log('[SymbolsService] Returning legacy response:', {
      symbolsCount: paginatedSymbols.length,
      total: symbolDtos.length,
    });

    return {
      symbols: paginatedSymbols,
      total: symbolDtos.length,
      offset,
      limit,
    };
  }

  /**
   * Get a symbol by ID
   */
  async getSymbolById(symbolId: string): Promise<SymbolResponseDto | null> {
    const port = this.getPort();
    const symbol = await port.getSymbolById(symbolId);

    if (!symbol) {
      return null;
    }

    return toSymbolResponseDto(symbol);
  }

  /**
   * Activate a symbol
   */
  async activateSymbol(symbolId: string): Promise<SymbolActivationResponseDto> {
    const port = this.getPort();
    const symbol = await port.activateSymbol(symbolId);

    return {
      success: true,
      symbol: symbol.symbol,
      message: `Symbol ${symbol.symbol} activated successfully`,
    };
  }

  /**
   * Deactivate a symbol
   */
  async deactivateSymbol(
    symbolId: string
  ): Promise<SymbolActivationResponseDto> {
    const port = this.getPort();
    const symbol = await port.deactivateSymbol(symbolId);

    return {
      success: true,
      symbol: symbol.symbol,
      message: `Symbol ${symbol.symbol} deactivated successfully`,
    };
  }

  /**
   * Enable a symbol by admin
   */
  async enableByAdmin(symbolId: string): Promise<SymbolActivationResponseDto> {
    const port = this.getPort();
    const symbol = await port.enableSymbolByAdmin(symbolId);

    return {
      success: true,
      symbol: symbol.symbol,
      message: `Symbol ${symbol.symbol} enabled by admin successfully`,
    };
  }

  /**
   * Disable a symbol by admin
   */
  async disableByAdmin(symbolId: string): Promise<SymbolActivationResponseDto> {
    const port = this.getPort();
    const symbol = await port.disableSymbolByAdmin(symbolId);

    return {
      success: true,
      symbol: symbol.symbol,
      message: `Symbol ${symbol.symbol} disabled by admin successfully`,
    };
  }

  /**
   * Sync symbols from an exchange
   */
  async syncSymbolsFromExchange(exchange: ValidExchange): Promise<{
    success: boolean;
    exchange: string;
    symbolsAdded: number;
    symbolsUpdated: number;
    symbolsDelisted: number;
    totalSymbols: number;
  }> {
    const port = this.getPort();

    // Validate exchange
    if (!VALID_EXCHANGES.includes(exchange)) {
      throw new Error(
        `Invalid exchange: ${exchange}. Valid exchanges: ${VALID_EXCHANGES.join(
          ', '
        )}`
      );
    }

    const result = await port.syncSymbolsFromExchange(exchange);

    return {
      success: result.success,
      exchange: result.exchange,
      symbolsAdded: result.symbolsAdded,
      symbolsUpdated: result.symbolsUpdated,
      symbolsDelisted: result.symbolsDelisted,
      totalSymbols: result.totalSymbols,
    };
  }
}
