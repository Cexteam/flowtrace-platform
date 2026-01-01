/**
 * Response DTOs for symbol endpoints
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SymbolResponseDto {
  @ApiProperty({ description: 'Unique symbol ID' })
  id!: string;

  @ApiProperty({ description: 'Trading symbol name', example: 'BTCUSDT' })
  symbol!: string;

  @ApiProperty({ description: 'Exchange name', example: 'binance' })
  exchange!: string;

  @ApiProperty({ description: 'Symbol status', example: 'active' })
  status!: string;

  @ApiPropertyOptional({ description: 'Base asset', example: 'BTC' })
  baseAsset?: string;

  @ApiPropertyOptional({ description: 'Quote asset', example: 'USDT' })
  quoteAsset?: string;

  @ApiPropertyOptional({ description: 'Price precision' })
  pricePrecision?: number;

  @ApiPropertyOptional({ description: 'Quantity precision' })
  quantityPrecision?: number;

  @ApiPropertyOptional({ description: 'Whether symbol is enabled' })
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Assigned worker ID' })
  workerId?: string;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: string;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: string;
}

export class SymbolListResponseDto {
  @ApiProperty({ type: [SymbolResponseDto], description: 'List of symbols' })
  symbols!: SymbolResponseDto[];

  @ApiProperty({ description: 'Total count of symbols' })
  total!: number;

  @ApiProperty({ description: 'Current offset' })
  offset!: number;

  @ApiProperty({ description: 'Current limit' })
  limit!: number;
}

export class SymbolActivationResponseDto {
  @ApiProperty({ description: 'Whether activation was successful' })
  success!: boolean;

  @ApiProperty({ description: 'Symbol that was activated' })
  symbol!: string;

  @ApiPropertyOptional({ description: 'Assigned worker ID' })
  workerId?: string;

  @ApiPropertyOptional({ description: 'Message' })
  message?: string;
}
