/**
 * FootprintController - REST endpoints for footprint data
 *
 * This controller is a thin wrapper that delegates to FootprintService.
 * Contains NO business logic - only HTTP concerns (validation, error handling).
 *
 */

import {
  Controller,
  Get,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { FootprintService } from '../../services/index.js';
import {
  GetFootprintDto,
  FootprintParamsDto,
  FootprintResponseDto,
  FootprintListResponseDto,
  VALID_TIMEFRAMES,
  type ValidTimeframe,
} from '../dto/index.js';

@ApiTags('footprint')
@Controller('api/footprint')
export class FootprintController {
  constructor(private readonly footprintService: FootprintService) {}

  @Get(':symbol')
  @ApiOperation({
    summary: 'Get footprint data for a symbol',
    description:
      'Retrieve footprint (order flow) data for a trading symbol within a time range',
  })
  @ApiParam({
    name: 'symbol',
    description: 'Trading symbol (e.g., BTCUSDT)',
    example: 'BTCUSDT',
  })
  @ApiQuery({
    name: 'timeframe',
    enum: VALID_TIMEFRAMES,
    description: 'Footprint timeframe',
  })
  @ApiQuery({
    name: 'startTime',
    required: false,
    type: Number,
    description: 'Start time (Unix timestamp ms)',
  })
  @ApiQuery({
    name: 'endTime',
    required: false,
    type: Number,
    description: 'End time (Unix timestamp ms)',
  })
  @ApiResponse({
    status: 200,
    description: 'Footprint data retrieved successfully',
    type: FootprintListResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid parameters',
  })
  @ApiResponse({
    status: 404,
    description: 'Symbol not found',
  })
  async getFootprints(
    @Param() params: FootprintParamsDto,
    @Query() query: GetFootprintDto
  ): Promise<FootprintListResponseDto> {
    try {
      return await this.footprintService.getFootprints(params.symbol, {
        timeframe: query.timeframe,
        startTime: query.startTime,
        endTime: query.endTime,
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Failed to get footprints: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':symbol/single')
  @ApiOperation({
    summary: 'Get single footprint for a specific candle',
    description: 'Retrieve footprint data for a specific candle time',
  })
  @ApiParam({
    name: 'symbol',
    description: 'Trading symbol (e.g., BTCUSDT)',
    example: 'BTCUSDT',
  })
  @ApiQuery({
    name: 'timeframe',
    enum: VALID_TIMEFRAMES,
    description: 'Footprint timeframe',
  })
  @ApiQuery({
    name: 'time',
    required: true,
    type: Number,
    description: 'Candle open time (Unix timestamp ms)',
  })
  @ApiResponse({
    status: 200,
    description: 'Footprint retrieved successfully',
    type: FootprintResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Footprint not found',
  })
  async getSingleFootprint(
    @Param('symbol') symbol: string,
    @Query('timeframe') timeframe: ValidTimeframe,
    @Query('time') time: number
  ): Promise<FootprintResponseDto> {
    try {
      // Validate timeframe
      if (!VALID_TIMEFRAMES.includes(timeframe)) {
        throw new HttpException(
          `Invalid timeframe: ${timeframe}. Valid timeframes: ${VALID_TIMEFRAMES.join(
            ', '
          )}`,
          HttpStatus.BAD_REQUEST
        );
      }

      const footprint = await this.footprintService.getSingleFootprint(
        symbol,
        timeframe,
        time
      );

      if (!footprint) {
        throw new HttpException(
          `Footprint not found for ${symbol} at ${time}`,
          HttpStatus.NOT_FOUND
        );
      }

      return footprint;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Failed to get footprint: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
