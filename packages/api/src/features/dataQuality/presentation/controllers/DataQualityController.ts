/**
 * DataQualityController - REST endpoints for data quality checks
 *
 * This controller is a thin wrapper that delegates to DataQualityService.
 * Contains NO business logic - only HTTP concerns (validation, error handling).
 *
 */

import {
  Controller,
  Get,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { DataQualityService } from '../../services/DataQualityService.js';
import { GapCheckResponseDto } from '../dto/index.js';

/**
 * Query DTO for checking trade gaps
 */
export class TradeGapQueryDto {
  symbol!: string;
  exchange!: string;
  from?: string;
  to?: string;
}

@ApiTags('data-quality')
@Controller('api/data-quality')
export class DataQualityController {
  constructor(private readonly dataQualityService: DataQualityService) {}

  @Get('gaps')
  @ApiOperation({
    summary: 'Check trade gaps',
    description:
      'Check for gaps in trade data for a specific symbol and exchange',
  })
  @ApiQuery({
    name: 'symbol',
    required: true,
    description: 'Symbol to check',
    example: 'BTCUSDT',
  })
  @ApiQuery({
    name: 'exchange',
    required: true,
    description: 'Exchange name',
    example: 'binance',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Start time (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'End time (ISO 8601)',
    example: '2024-01-02T00:00:00Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Gap check completed',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid parameters',
  })
  async checkTradeGaps(@Query() query: TradeGapQueryDto) {
    const { symbol, exchange, from, to } = query;

    // Validate required parameters
    if (!symbol || !exchange) {
      throw new HttpException(
        'Symbol and exchange are required',
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      return await this.dataQualityService.checkTradeGaps({
        symbol,
        exchange,
        from,
        to,
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Handle validation errors from service
      if (message.includes('must be before')) {
        throw new HttpException(message, HttpStatus.BAD_REQUEST);
      }

      throw new HttpException(
        `Failed to check trade gaps: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
