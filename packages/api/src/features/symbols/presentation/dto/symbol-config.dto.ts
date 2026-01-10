/**
 * DTOs for symbol configuration management
 *
 * Handles bin size configuration for footprint charts.
 */

import {
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsInt,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO for symbol configuration
 */
export class SymbolConfigResponseDto {
  @ApiProperty({
    description: 'Trading symbol name',
    example: 'BTCUSDT',
  })
  symbol!: string;

  @ApiProperty({
    description: 'Exchange name',
    example: 'binance',
  })
  exchange!: string;

  @ApiProperty({
    description: 'Tick value (minimum price increment from exchange)',
    example: 0.1,
  })
  tickValue!: number;

  @ApiProperty({
    description:
      'Bin multiplier for footprint aggregation. null = auto-calculated',
    example: 50,
    nullable: true,
  })
  binMultiplier!: number | null;

  @ApiProperty({
    description:
      'Effective bin size (tickValue × binMultiplier). Used for footprint price binning.',
    example: 5.0,
  })
  effectiveBinSize!: number;

  @ApiProperty({
    description: 'Price precision (decimal places)',
    example: 2,
  })
  pricePrecision!: number;

  @ApiProperty({
    description: 'Quantity precision (decimal places)',
    example: 3,
  })
  quantityPrecision!: number;

  @ApiProperty({
    description: 'Minimum order quantity',
    example: 0.001,
  })
  minQuantity!: number;

  @ApiProperty({
    description: 'Maximum order quantity',
    example: 9000,
  })
  maxQuantity!: number;
}

/**
 * Request DTO for updating symbol configuration
 */
export class UpdateSymbolConfigDto {
  @ApiPropertyOptional({
    description:
      'Bin multiplier for footprint aggregation. Set to null to use auto-calculated value. Must produce a "nice" effective bin size when multiplied by tickValue.',
    example: 50,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o) => o.binMultiplier !== null)
  @Type(() => Number)
  @IsInt({ message: 'binMultiplier must be an integer' })
  @Min(1, { message: 'binMultiplier must be at least 1' })
  @Max(10000, { message: 'binMultiplier must be at most 10000' })
  binMultiplier?: number | null;
}

/**
 * Response DTO for bin size validation
 */
export class BinSizeValidationResponseDto {
  @ApiProperty({
    description: 'Whether the bin multiplier produces a valid nice bin size',
    example: true,
  })
  isValid!: boolean;

  @ApiProperty({
    description: 'The effective bin size that would result',
    example: 5.0,
  })
  effectiveBinSize!: number;

  @ApiPropertyOptional({
    description: 'Error message if validation failed',
    example:
      'Effective bin size 4.8 does not match NICE_BIN_SIZE pattern [1, 2, 2.5, 4, 5] × 10^n',
  })
  error?: string;

  @ApiPropertyOptional({
    description: 'Suggested valid bin multipliers',
    example: [25, 40, 50],
    type: [Number],
  })
  suggestions?: number[];
}
