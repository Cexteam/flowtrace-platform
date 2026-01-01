/**
 * Response DTOs for footprint endpoints
 *
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PriceBinDto {
  @ApiProperty({ description: 'Price level' })
  price!: number;

  @ApiProperty({ description: 'Buy volume at this price' })
  bidVolume!: number;

  @ApiProperty({ description: 'Sell volume at this price' })
  askVolume!: number;

  @ApiPropertyOptional({ description: 'Delta (bid - ask)' })
  delta?: number;

  @ApiPropertyOptional({ description: 'Total volume' })
  totalVolume?: number;

  @ApiPropertyOptional({ description: 'Number of trades at this price' })
  trades?: number;
}

export class FootprintResponseDto {
  @ApiProperty({ description: 'Trading symbol' })
  symbol!: string;

  @ApiProperty({ description: 'Timeframe' })
  timeframe!: string;

  @ApiProperty({ description: 'Candle open time (Unix timestamp ms)' })
  openTime!: number;

  @ApiProperty({ description: 'Candle close time (Unix timestamp ms)' })
  closeTime!: number;

  @ApiProperty({ description: 'Open price' })
  open!: number;

  @ApiProperty({ description: 'High price' })
  high!: number;

  @ApiProperty({ description: 'Low price' })
  low!: number;

  @ApiProperty({ description: 'Close price' })
  close!: number;

  @ApiProperty({ description: 'Total volume' })
  volume!: number;

  @ApiProperty({ description: 'Total buy volume' })
  buyVolume!: number;

  @ApiProperty({ description: 'Total sell volume' })
  sellVolume!: number;

  @ApiProperty({ description: 'Delta (buy - sell volume)' })
  delta!: number;

  @ApiProperty({
    type: [PriceBinDto],
    description: 'Price bins with volume distribution',
  })
  clusters!: PriceBinDto[];

  @ApiPropertyOptional({ description: 'Point of Control (POC) price' })
  poc?: number;

  @ApiPropertyOptional({ description: 'Value Area High' })
  vah?: number;

  @ApiPropertyOptional({ description: 'Value Area Low' })
  val?: number;
}

export class FootprintListResponseDto {
  @ApiProperty({ description: 'Trading symbol' })
  symbol!: string;

  @ApiProperty({ description: 'Timeframe' })
  timeframe!: string;

  @ApiProperty({
    type: [FootprintResponseDto],
    description: 'List of footprints',
  })
  footprints!: FootprintResponseDto[];

  @ApiProperty({ description: 'Total count of footprints returned' })
  count!: number;
}
