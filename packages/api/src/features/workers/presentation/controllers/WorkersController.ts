/**
 * WorkersController - REST endpoints for worker management
 *
 * This controller is a thin wrapper that delegates to WorkersService.
 * Contains NO business logic - only HTTP concerns (validation, error handling).
 *
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { WorkersService } from '../../services/index.js';
import {
  SpawnWorkerDto,
  WorkerResponseDto,
  WorkerListResponseDto,
  WorkerHealthResponseDto,
  SpawnWorkerResponseDto,
} from '../dto/index.js';

@ApiTags('workers')
@Controller('api/workers')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Get()
  @ApiOperation({
    summary: 'List all workers',
    description: 'Retrieve a list of all workers with their status',
  })
  @ApiResponse({
    status: 200,
    description: 'Workers retrieved successfully',
    type: WorkerListResponseDto,
  })
  async listWorkers(): Promise<WorkerListResponseDto> {
    try {
      return await this.workersService.getWorkers();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Failed to list workers: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':workerId')
  @ApiOperation({
    summary: 'Get worker by ID',
    description: 'Retrieve details for a specific worker by ID',
  })
  @ApiParam({
    name: 'workerId',
    description: 'Worker ID',
    example: 'worker_0',
  })
  @ApiResponse({
    status: 200,
    description: 'Worker retrieved successfully',
    type: WorkerResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Worker not found',
  })
  async getWorker(
    @Param('workerId') workerId: string
  ): Promise<WorkerResponseDto> {
    try {
      const worker = await this.workersService.getWorkerById(workerId);

      if (!worker) {
        throw new HttpException(
          `Worker ${workerId} not found`,
          HttpStatus.NOT_FOUND
        );
      }

      return worker;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Failed to get worker: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post()
  @ApiOperation({
    summary: 'Spawn a new worker',
    description: 'Spawn a new worker with the specified configuration',
  })
  @ApiBody({ type: SpawnWorkerDto })
  @ApiResponse({
    status: 201,
    description: 'Worker spawned successfully',
    type: SpawnWorkerResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid configuration',
  })
  async spawnWorker(
    @Body() config: SpawnWorkerDto
  ): Promise<SpawnWorkerResponseDto> {
    // Note: Worker spawning is typically done during pool initialization
    // This endpoint is for dynamic worker spawning which may not be fully supported
    // by the current WorkerPoolPort interface

    throw new HttpException(
      'Dynamic worker spawning is not supported. Workers are spawned during pool initialization.',
      HttpStatus.NOT_IMPLEMENTED
    );
  }

  @Get(':workerId/health')
  @ApiOperation({
    summary: 'Get worker health metrics',
    description: 'Retrieve health metrics for a specific worker',
  })
  @ApiParam({
    name: 'workerId',
    description: 'Worker ID',
    example: 'worker_0',
  })
  @ApiResponse({
    status: 200,
    description: 'Worker health retrieved successfully',
    type: WorkerHealthResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Worker not found',
  })
  async getWorkerHealth(
    @Param('workerId') workerId: string
  ): Promise<WorkerHealthResponseDto> {
    try {
      const health = await this.workersService.getWorkerHealth(workerId);

      if (!health) {
        throw new HttpException(
          `Worker ${workerId} not found`,
          HttpStatus.NOT_FOUND
        );
      }

      return health;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Failed to get worker health: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
