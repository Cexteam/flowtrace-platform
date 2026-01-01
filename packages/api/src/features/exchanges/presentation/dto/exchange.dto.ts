/**
 * DTOs for exchange management
 *
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Valid exchange names
 */
export const VALID_EXCHANGES = [
  'binance',
  'bybit',
  'okx',
  'kraken',
  'coinbase',
] as const;
export type ValidExchange = (typeof VALID_EXCHANGES)[number];

/**
 * Implementation status for exchanges
 */
export type ImplementationStatus =
  | 'implemented'
  | 'not_implemented'
  | 'partial';

/**
 * Exchange response DTO
 */
export class ExchangeResponseDto {
  @ApiProperty({ description: 'Exchange name', example: 'binance' })
  name!: string;

  @ApiProperty({
    description: 'Implementation status',
    enum: ['implemented', 'not_implemented', 'partial'],
  })
  implementationStatus!: ImplementationStatus;

  @ApiProperty({ description: 'Whether exchange is healthy' })
  healthStatus!: boolean;

  @ApiProperty({ description: 'Number of symbols from this exchange' })
  symbolCount!: number;

  @ApiPropertyOptional({ description: 'Last health check timestamp' })
  lastHealthCheck?: string;

  @ApiProperty({ description: 'Whether exchange is enabled' })
  enabled!: boolean;
}

/**
 * Exchange list response DTO
 */
export class ExchangeListResponseDto {
  @ApiProperty({
    type: [ExchangeResponseDto],
    description: 'List of exchanges',
  })
  exchanges!: ExchangeResponseDto[];

  @ApiProperty({ description: 'Total number of exchanges' })
  total!: number;
}

/**
 * Exchange health response DTO
 */
export class ExchangeHealthResponseDto {
  @ApiProperty({ description: 'Exchange name' })
  name!: string;

  @ApiProperty({ description: 'Whether exchange is healthy' })
  isHealthy!: boolean;

  @ApiProperty({ description: 'Health check timestamp' })
  checkedAt!: string;

  @ApiPropertyOptional({ description: 'Latency in milliseconds' })
  latencyMs?: number;

  @ApiPropertyOptional({ description: 'Error message if unhealthy' })
  error?: string;
}

/**
 * Exchange enable/disable response DTO
 */
export class ExchangeToggleResponseDto {
  @ApiProperty({ description: 'Whether operation was successful' })
  success!: boolean;

  @ApiProperty({ description: 'Exchange name' })
  exchange!: string;

  @ApiProperty({ description: 'New enabled state' })
  enabled!: boolean;

  @ApiPropertyOptional({ description: 'Message' })
  message?: string;
}
