/**
 * DTOs for worker management
 *
 */

import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for spawning a new worker
 */
export class SpawnWorkerDto {
  @ApiPropertyOptional({
    description: 'Maximum symbols this worker can handle',
    default: 50,
    minimum: 1,
    maximum: 200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  maxSymbols?: number = 50;

  @ApiPropertyOptional({
    description: 'Memory limit in MB',
    default: 512,
    minimum: 128,
    maximum: 4096,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(128)
  @Max(4096)
  memoryLimitMB?: number = 512;

  @ApiPropertyOptional({
    description: 'CPU usage threshold percentage for health warning',
    default: 80,
    minimum: 50,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(50)
  @Max(100)
  cpuThreshold?: number = 80;
}

/**
 * Worker health metrics response
 */
export class WorkerHealthMetricsDto {
  @ApiProperty({ description: 'Total trades processed by this worker' })
  totalTradesProcessed!: number;

  @ApiProperty({ description: 'Events published to Redis' })
  eventsPublished!: number;

  @ApiProperty({ description: 'Average processing time in milliseconds' })
  averageProcessingTimeMs!: number;

  @ApiProperty({ description: 'Memory usage in bytes' })
  memoryUsageBytes!: number;

  @ApiProperty({ description: 'CPU usage percentage (0-100)' })
  cpuUsagePercent!: number;

  @ApiProperty({ description: 'Error count' })
  errorCount!: number;

  @ApiPropertyOptional({ description: 'Last error message if any' })
  lastError?: string;
}

/**
 * Worker response DTO
 */
export class WorkerResponseDto {
  @ApiProperty({ description: 'Unique worker ID' })
  workerId!: string;

  @ApiProperty({ description: 'Thread ID' })
  threadId!: number;

  @ApiProperty({
    description: 'Worker state',
    enum: ['initializing', 'ready', 'busy', 'unhealthy', 'terminated'],
  })
  state!: string;

  @ApiProperty({ description: 'Number of assigned symbols' })
  symbolCount!: number;

  @ApiProperty({ description: 'Uptime in seconds' })
  uptimeSeconds!: number;

  @ApiProperty({ description: 'Whether worker has sent WORKER_READY message' })
  isReady!: boolean;

  @ApiProperty({ description: 'Health metrics' })
  healthMetrics!: WorkerHealthMetricsDto;

  @ApiProperty({ description: 'List of assigned symbols' })
  assignedSymbols!: string[];

  @ApiProperty({ description: 'Last activity timestamp' })
  lastActivityAt!: string;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: string;
}

/**
 * Worker list response DTO
 */
export class WorkerListResponseDto {
  @ApiProperty({ type: [WorkerResponseDto], description: 'List of workers' })
  workers!: WorkerResponseDto[];

  @ApiProperty({ description: 'Total number of workers' })
  totalWorkers!: number;

  @ApiProperty({ description: 'Number of healthy workers' })
  healthyWorkers!: number;

  @ApiProperty({ description: 'Number of unhealthy workers' })
  unhealthyWorkers!: number;

  @ApiProperty({ description: 'Number of ready workers' })
  readyWorkers!: number;

  @ApiProperty({ description: 'Pool uptime in seconds' })
  uptimeSeconds!: number;
}

/**
 * Worker health response DTO
 */
export class WorkerHealthResponseDto {
  @ApiProperty({ description: 'Worker ID' })
  workerId!: string;

  @ApiProperty({ description: 'Whether worker is healthy' })
  isHealthy!: boolean;

  @ApiProperty({ description: 'Health metrics' })
  healthMetrics!: WorkerHealthMetricsDto;

  @ApiProperty({ description: 'Last heartbeat timestamp' })
  lastHeartbeat!: string;
}

/**
 * Spawn worker response DTO
 */
export class SpawnWorkerResponseDto {
  @ApiProperty({ description: 'Whether spawn was successful' })
  success!: boolean;

  @ApiPropertyOptional({ description: 'Worker ID if successful' })
  workerId?: string;

  @ApiPropertyOptional({ description: 'Thread ID if successful' })
  threadId?: number;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  error?: string;

  @ApiPropertyOptional({ description: 'Message' })
  message?: string;
}

/**
 * Worker stats response DTO
 * Provides summary statistics about the worker pool
 */
export class WorkerStatsDto {
  @ApiProperty({ description: 'Total number of workers' })
  totalWorkers!: number;

  @ApiProperty({ description: 'Number of active (healthy) workers' })
  activeWorkers!: number;

  @ApiProperty({ description: 'Total symbols assigned across all workers' })
  totalSymbols!: number;
}
