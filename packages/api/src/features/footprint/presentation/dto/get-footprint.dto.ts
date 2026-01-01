/**
 * DTO for getting footprint data
 *
 */

import { IsEnum, IsOptional, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const VALID_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export type ValidTimeframe = (typeof VALID_TIMEFRAMES)[number];

export class GetFootprintDto {
  @ApiProperty({
    description: 'Footprint timeframe',
    enum: VALID_TIMEFRAMES,
    example: '1m',
  })
  @IsEnum(VALID_TIMEFRAMES, {
    message: `timeframe must be one of: ${VALID_TIMEFRAMES.join(', ')}`,
  })
  timeframe!: ValidTimeframe;

  @ApiPropertyOptional({
    description: 'Candle open time (Unix timestamp in milliseconds)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  time?: number;

  @ApiPropertyOptional({
    description: 'Start time for range query (Unix timestamp in milliseconds)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  startTime?: number;

  @ApiPropertyOptional({
    description: 'End time for range query (Unix timestamp in milliseconds)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  endTime?: number;
}

export class FootprintParamsDto {
  @ApiProperty({
    description: 'Trading symbol',
    example: 'BTCUSDT',
  })
  @IsString()
  symbol!: string;
}
