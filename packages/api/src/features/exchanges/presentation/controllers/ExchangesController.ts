/**
 * ExchangesController - REST endpoints for exchange management
 *
 * This controller is a thin wrapper that delegates to ExchangesService.
 * Contains NO business logic - only HTTP concerns (validation, error handling).
 *
 */

import {
  Controller,
  Get,
  Post,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import {
  ExchangesService,
  type PaginatedExchangesResponse,
} from '../../services/index.js';
import {
  ExchangeListResponseDto,
  ExchangeHealthResponseDto,
  ExchangeToggleResponseDto,
  VALID_EXCHANGES,
  type ValidExchange,
} from '../dto/index.js';

@ApiTags('exchanges')
@Controller('api/exchanges')
export class ExchangesController {
  constructor(private readonly exchangesService: ExchangesService) {}

  @Get()
  @ApiOperation({
    summary: 'List all exchanges',
    description: 'Retrieve a list of all exchanges with their status',
  })
  @ApiResponse({
    status: 200,
    description: 'Exchanges retrieved successfully',
    type: ExchangeListResponseDto,
  })
  async listExchanges(): Promise<
    ExchangeListResponseDto | PaginatedExchangesResponse
  > {
    try {
      return await this.exchangesService.getExchanges();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Failed to list exchanges: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':name/health')
  @ApiOperation({
    summary: 'Health check specific exchange',
    description: 'Check the health status of a specific exchange API',
  })
  @ApiParam({
    name: 'name',
    description: 'Exchange name',
    enum: VALID_EXCHANGES,
    example: 'binance',
  })
  @ApiResponse({
    status: 200,
    description: 'Health check completed',
    type: ExchangeHealthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid exchange name',
  })
  async getExchangeHealth(
    @Param('name') name: ValidExchange
  ): Promise<ExchangeHealthResponseDto> {
    // Validate exchange name
    if (!VALID_EXCHANGES.includes(name)) {
      throw new HttpException(
        `Invalid exchange: ${name}. Valid exchanges: ${VALID_EXCHANGES.join(
          ', '
        )}`,
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      return await this.exchangesService.getExchangeHealth(name);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Failed to get exchange health: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':name/enable')
  @ApiOperation({
    summary: 'Enable exchange',
    description: 'Enable an exchange for data ingestion',
  })
  @ApiParam({
    name: 'name',
    description: 'Exchange name',
    enum: VALID_EXCHANGES,
    example: 'binance',
  })
  @ApiResponse({
    status: 200,
    description: 'Exchange enabled successfully',
    type: ExchangeToggleResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid exchange name or exchange not implemented',
  })
  async enableExchange(
    @Param('name') name: ValidExchange
  ): Promise<ExchangeToggleResponseDto> {
    // Validate exchange name
    if (!VALID_EXCHANGES.includes(name)) {
      throw new HttpException(
        `Invalid exchange: ${name}. Valid exchanges: ${VALID_EXCHANGES.join(
          ', '
        )}`,
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      return await this.exchangesService.enableExchange(name);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Failed to enable exchange: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':name/disable')
  @ApiOperation({
    summary: 'Disable exchange',
    description: 'Disable an exchange from data ingestion',
  })
  @ApiParam({
    name: 'name',
    description: 'Exchange name',
    enum: VALID_EXCHANGES,
    example: 'binance',
  })
  @ApiResponse({
    status: 200,
    description: 'Exchange disabled successfully',
    type: ExchangeToggleResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid exchange name',
  })
  async disableExchange(
    @Param('name') name: ValidExchange
  ): Promise<ExchangeToggleResponseDto> {
    // Validate exchange name
    if (!VALID_EXCHANGES.includes(name)) {
      throw new HttpException(
        `Invalid exchange: ${name}. Valid exchanges: ${VALID_EXCHANGES.join(
          ', '
        )}`,
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      return await this.exchangesService.disableExchange(name);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Failed to disable exchange: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
