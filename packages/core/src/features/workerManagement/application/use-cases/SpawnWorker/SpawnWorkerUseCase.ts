/**
 * SpawnWorkerUseCase - Application use case for spawning worker threads
 *
 * Handles the logic for spawning new worker threads and registering them
 * with the worker pool.
 *
 */

import { injectable, inject } from 'inversify';
import { WORKER_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/workerManagement/types.js';
import { WorkerThreadPort } from '../../ports/out/WorkerThreadPort.js';
import { WorkerThread } from '../../../domain/entities/WorkerThread.js';
import { SpawnWorkerRequest, SpawnWorkerResult } from './DTO.js';
import { createLogger } from '../../../../../shared/lib/logger/logger.js';

const logger = createLogger('SpawnWorkerUseCase');

/**
 * SpawnWorkerUseCase - Spawns and initializes worker threads
 */
@injectable()
export class SpawnWorkerUseCase {
  constructor(
    @inject(WORKER_MANAGEMENT_TYPES.WorkerThreadPort)
    private workerThreadPort: WorkerThreadPort
  ) {}

  /**
   * Execute the spawn worker use case
   *
   * @param request - Spawn worker request
   * @returns Spawn result with worker information
   */
  async execute(request: SpawnWorkerRequest): Promise<SpawnWorkerResult> {
    const startTime = Date.now();

    try {
      logger.info(`Spawning worker ${request.workerId}...`);

      // Check if worker already exists
      if (this.workerThreadPort.hasWorker(request.workerId)) {
        return {
          success: false,
          workerId: request.workerId,
          error: `Worker ${request.workerId} already exists`,
          spawnTimeMs: Date.now() - startTime,
        };
      }

      // Spawn the worker thread (scriptPath is optional - adapter uses default if not provided)
      const workerInfo = this.workerThreadPort.spawn({
        scriptPath: request.scriptPath, // undefined triggers default path in adapter
        workerData: {
          workerId: request.workerId,
          initialSymbols: request.initialSymbols || [],
          socketPath: request.socketPath, // Pass socketPath to worker
        },
        resourceLimits: request.resourceLimits,
      });

      // Create domain entity for tracking
      const workerEntity = new WorkerThread(
        request.workerId,
        workerInfo.threadId,
        request.initialSymbols || []
      );

      logger.info(
        `Worker ${request.workerId} spawned successfully (threadId: ${
          workerInfo.threadId
        }, socketPath: ${request.socketPath || 'default'})`
      );

      return {
        success: true,
        workerId: request.workerId,
        threadId: workerInfo.threadId,
        spawnTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      logger.error(
        `Failed to spawn worker ${request.workerId}: ${errorMessage}`
      );

      return {
        success: false,
        workerId: request.workerId,
        error: errorMessage,
        spawnTimeMs: Date.now() - startTime,
      };
    }
  }
}
