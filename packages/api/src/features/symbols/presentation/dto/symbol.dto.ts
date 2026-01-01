/**
 * DTOs for symbol management
 *
 */

import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const VALID_EXCHANGES = ['binance', 'bybit', 'okx'] as const;
export type ValidExchange = (typeof VALID_EXCHANGES)[number];

export const VALID_SYMBOL_STATUS = [
  'active',
  'inactive',
  'delisted',
  'pending_review',
] as const;
export type ValidSymbolStatus = (typeof VALID_SYMBOL_STATUS)[number];

export class CreateSymbolDto {
  @ApiProperty({
    description: 'Trading symbol name',
    example: 'BTCUSDT',
  })
  @IsString()
  symbol!: string;

  @ApiProperty({
    description: 'Exchange name',
    enum: VALID_EXCHANGES,
    example: 'binance',
  })
  @IsEnum(VALID_EXCHANGES)
  exchange!: ValidExchange;

  @ApiPropertyOptional({
    description: 'Base asset',
    example: 'BTC',
  })
  @IsOptional()
  @IsString()
  baseAsset?: string;

  @ApiPropertyOptional({
    description: 'Quote asset',
    example: 'USDT',
  })
  @IsOptional()
  @IsString()
  quoteAsset?: string;

  @ApiPropertyOptional({
    description: 'Price precision (decimal places)',
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(18)
  pricePrecision?: number;

  @ApiPropertyOptional({
    description: 'Quantity precision (decimal places)',
    example: 6,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(18)
  quantityPrecision?: number;
}

export class UpdateSymbolDto {
  @ApiPropertyOptional({
    description: 'Symbol status',
    enum: VALID_SYMBOL_STATUS,
  })
  @IsOptional()
  @IsEnum(VALID_SYMBOL_STATUS)
  status?: ValidSymbolStatus;

  @ApiPropertyOptional({
    description: 'Whether symbol is enabled for trading',
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Price precision (decimal places)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(18)
  pricePrecision?: number;

  @ApiPropertyOptional({
    description: 'Quantity precision (decimal places)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(18)
  quantityPrecision?: number;
}

export class SymbolQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by exchange',
    enum: VALID_EXCHANGES,
  })
  @IsOptional()
  @IsEnum(VALID_EXCHANGES)
  exchange?: ValidExchange;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: VALID_SYMBOL_STATUS,
  })
  @IsOptional()
  @IsEnum(VALID_SYMBOL_STATUS)
  status?: ValidSymbolStatus;

  @ApiPropertyOptional({
    description: 'Search by symbol name',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number = 100;

  @ApiPropertyOptional({
    description: 'Offset for pagination',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}
