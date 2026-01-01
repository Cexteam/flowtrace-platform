/**
 * SymbolsController - REST endpoints for symbol management
 *
 * This controller is a thin wrapper that delegates to SymbolsService.
 * Contains NO business logic - only HTTP concerns (validation, error handling).
 *
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import {
  SymbolsService,
  type PaginatedSymbolsResponse,
} from '../../services/index.js';
import {
  SymbolQueryDto,
  SymbolResponseDto,
  SymbolListResponseDto,
  SymbolActivationResponseDto,
  VALID_EXCHANGES,
  type ValidExchange,
} from '../dto/index.js';

@ApiTags('symbols')
@Controller('api/symbols')
export class SymbolsController {
  constructor(private readonly symbolsService: SymbolsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all symbols',
    description: 'Retrieve a list of trading symbols with optional filtering',
  })
  @ApiResponse({
    status: 200,
    description: 'Symbols retrieved successfully',
    type: SymbolListResponseDto,
  })
  async listSymbols(
    @Query() query: SymbolQueryDto
  ): Promise<SymbolListResponseDto | PaginatedSymbolsResponse> {
    try {
      return await this.symbolsService.getSymbols(query);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Failed to list symbols: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':symbolId')
  @ApiOperation({
    summary: 'Get symbol by ID',
    description: 'Retrieve details for a specific trading symbol by ID',
  })
  @ApiParam({
    name: 'symbolId',
    description: 'Symbol ID',
    example: 'binance-BTCUSDT',
  })
  @ApiResponse({
    status: 200,
    description: 'Symbol retrieved successfully',
    type: SymbolResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Symbol not found',
  })
  async getSymbol(
    @Param('symbolId') symbolId: string
  ): Promise<SymbolResponseDto> {
    try {
      const symbol = await this.symbolsService.getSymbolById(symbolId);

      if (!symbol) {
        throw new HttpException(
          `Symbol ${symbolId} not found`,
          HttpStatus.NOT_FOUND
        );
      }

      return symbol;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Failed to get symbol: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':symbolId/activate')
  @ApiOperation({
    summary: 'Activate a symbol',
    description: 'Activate a symbol for trading and assign it to a worker',
  })
  @ApiParam({
    name: 'symbolId',
    description: 'Symbol ID',
    example: 'binance-BTCUSDT',
  })
  @ApiResponse({
    status: 200,
    description: 'Symbol activated successfully',
    type: SymbolActivationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Symbol not found',
  })
  async activateSymbol(
    @Param('symbolId') symbolId: string
  ): Promise<SymbolActivationResponseDto> {
    try {
      return await this.symbolsService.activateSymbol(symbolId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Failed to activate symbol: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':symbolId/deactivate')
  @ApiOperation({
    summary: 'Deactivate a symbol',
    description: 'Deactivate a symbol and remove it from worker assignment',
  })
  @ApiParam({
    name: 'symbolId',
    description: 'Symbol ID',
    example: 'binance-BTCUSDT',
  })
  @ApiResponse({
    status: 200,
    description: 'Symbol deactivated successfully',
    type: SymbolActivationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Symbol not found',
  })
  async deactivateSymbol(
    @Param('symbolId') symbolId: string
  ): Promise<SymbolActivationResponseDto> {
    try {
      return await this.symbolsService.deactivateSymbol(symbolId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Failed to deactivate symbol: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('sync/:exchange')
  @ApiOperation({
    summary: 'Sync symbols from exchange',
    description: 'Fetch and sync symbols from a specific exchange',
  })
  @ApiParam({
    name: 'exchange',
    description: 'Exchange name',
    enum: VALID_EXCHANGES,
    example: 'binance',
  })
  @ApiResponse({
    status: 200,
    description: 'Symbols synced successfully',
  })
  async syncSymbols(@Param('exchange') exchange: ValidExchange): Promise<{
    success: boolean;
    exchange: string;
    symbolsAdded: number;
    symbolsUpdated: number;
    symbolsDelisted: number;
    totalSymbols: number;
  }> {
    try {
      // Validate exchange
      if (!VALID_EXCHANGES.includes(exchange)) {
        throw new HttpException(
          `Invalid exchange: ${exchange}. Valid exchanges: ${VALID_EXCHANGES.join(
            ', '
          )}`,
          HttpStatus.BAD_REQUEST
        );
      }

      return await this.symbolsService.syncSymbolsFromExchange(exchange);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Failed to sync symbols: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
