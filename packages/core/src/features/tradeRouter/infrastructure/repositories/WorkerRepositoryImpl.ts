/**
 * Infrastructure Implementation: Worker Repository
 * IPC-backed implementation using worker-owned architecture
 * No direct database connections - delegates everything to worker threads via infrastructure port
 *
 * All deployments now use IPC-based persistence via SQLite.
 *
 */

import { injectable, inject } from 'inversify';
import {
  WorkerRepository,
  WorkerStats,
} from '../../domain/repositories/WorkerRepository.js';
import { WorkerThread } from '../../domain/entities/WorkerThread.js';
import { WORKER_MANAGEMENT_TYPES } from '../../../../shared/lib/di/bindings/features/workerManagement/types.js';
import type {
  WorkerCommunicationPort,
  WorkerMessage,
} from '../../../workerManagement/application/ports/in/WorkerCommunicationPort.js';
import type { WorkerPoolPort } from '../../../workerManagement/application/ports/in/WorkerPoolPort.js';

@injectable()
export class WorkerRepositoryImpl implements WorkerRepository {
  constructor(
    @inject(WORKER_MANAGEMENT_TYPES.WorkerCommunicationPort)
    private readonly workerCommunicationPort: WorkerCommunicationPort,
    @inject(WORKER_MANAGEMENT_TYPES.WorkerPoolPort)
    private readonly workerPoolPort: WorkerPoolPort
  ) {}

  /**
   * Save worker state - tracks state in main thread
   * Note: Worker state is managed locally in main thread, not persisted to worker
   * The worker owns its own internal state (candle processing, footprint data)
   * Main thread only tracks routing/assignment state
   */
  async save(worker: WorkerThread): Promise<WorkerThread> {
    // Worker state is tracked in-memory in main thread
    // No need to send message to worker - worker manages its own internal state
    // This method is called to update main thread's view of worker assignments
    return worker;
  }

  /**
   * Find worker by ID - Uses WorkerPoolPort for worker management
   */
  async findById(workerId: string): Promise<WorkerThread | null> {
    try {
      // Check if worker exists in pool first
      if (!this.workerPoolPort.hasWorker(workerId)) {
        return null;
      }

      // Get worker from pool
      const poolWorker = this.workerPoolPort.getWorker(workerId);
      if (!poolWorker) {
        return null;
      }

      // Convert pool worker to domain entity
      return this.poolWorkerToDomain(poolWorker);
    } catch (error) {
      console.error(`Failed to find worker ${workerId}:`, error);
      return null;
    }
  }

  /**
   * Find all workers - Uses WorkerPoolPort for worker management
   */
  async findAll(): Promise<WorkerThread[]> {
    try {
      // Get all worker IDs from pool
      const workerIds = this.workerPoolPort.getWorkerIds();

      // Load each worker's state
      const workers: WorkerThread[] = [];
      for (const workerId of workerIds) {
        const worker = await this.findById(workerId);
        if (worker) {
          workers.push(worker);
        }
      }

      return workers;
    } catch (error) {
      console.error('Failed to find all workers:', error);
      return [];
    }
  }

  /**
   * Update worker state - delegate to worker thread
   */
  async update(worker: WorkerThread): Promise<WorkerThread> {
    return this.save(worker);
  }

  /**
   * Delete worker state - this doesn't delete the worker, just clears its persistent state
   */
  async delete(workerId: string): Promise<void> {
    try {
      console.log(
        `Worker state cleanup notified for ${workerId} - worker handles its own persistence`
      );
    } catch (error) {
      console.error(`Failed to delete worker ${workerId} state:`, error);
      throw new Error(
        `Worker deletion failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Find all active workers - Uses WorkerPoolPort for worker management
   */
  async findActiveWorkers(): Promise<WorkerThread[]> {
    try {
      const allWorkers = await this.findAll();

      const activeWorkers = allWorkers.filter(
        (worker) => worker.status === 'ready' || worker.status === 'busy'
      );

      return activeWorkers;
    } catch (error) {
      return [];
    }
  }

  /**
   * Find workers that own a specific symbol
   */
  async findWorkersBySymbol(symbol: string): Promise<WorkerThread[]> {
    try {
      const allWorkers = await this.findAll();
      const result = allWorkers.filter((worker) => worker.hasSymbol(symbol));
      return result;
    } catch (error) {
      console.error(`Failed to find workers by symbol ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get system-wide load statistics - Uses WorkerCommunicationPort
   */
  async getSystemLoad(): Promise<WorkerStats[]> {
    try {
      const allWorkers = await this.findAll();

      const workerStatsPromises = allWorkers.map(async (worker) => {
        try {
          const message: WorkerMessage = {
            id: `sync_${worker.id}_${Date.now()}`,
            type: 'SYNC_METRICS',
            data: { command: 'SYNC_METRICS' },
            timestamp: new Date(),
          };

          const response = await this.workerCommunicationPort.sendToWorker(
            worker.id,
            message
          );
          const metrics = response?.result || {};

          return {
            workerId: worker.id,
            status: this.mapWorkerStatusToString(worker.status),
            symbolCount: worker.getSymbolCount(),
            cpuUsage: (metrics as any).cpuUsage || 0,
            memoryUsage: (metrics as any).memoryUsage || 0,
            lastActivity: worker.lastActivityAt,
            queueSize: (metrics as any).messageQueueSize || 0,
            uptimeSeconds: (metrics as any).uptimeSeconds || 0,
          };
        } catch (error) {
          console.error(
            `Failed to sync metrics for worker ${worker.id}:`,
            error
          );
          return {
            workerId: worker.id,
            status: 'error' as const,
            symbolCount: worker.getSymbolCount(),
            cpuUsage: 0,
            memoryUsage: 0,
            lastActivity: worker.lastActivityAt,
            queueSize: 0,
            uptimeSeconds: 0,
          };
        }
      });

      return await Promise.all(workerStatsPromises);
    } catch (error) {
      console.error('Failed to get system load:', error);
      return [];
    }
  }

  /**
   * Health check - Uses WorkerPoolPort and WorkerCommunicationPort
   */
  async healthCheck(): Promise<boolean> {
    try {
      const workerIds = this.workerPoolPort.getWorkerIds();

      if (workerIds.length === 0) {
        return false;
      }

      // Try to ping at least one worker to verify communication
      for (const workerId of workerIds) {
        try {
          const message: WorkerMessage = {
            id: `health_${workerId}_${Date.now()}`,
            type: 'SYNC_METRICS',
            data: { command: 'SYNC_METRICS' },
            timestamp: new Date(),
          };

          const response = await this.workerCommunicationPort.sendToWorker(
            workerId,
            message
          );
          if (response && response.success) {
            return true;
          }
        } catch (error) {
          console.warn(`Worker ${workerId} health check failed:`, error);
        }
      }

      return false;
    } catch (error) {
      console.error('WorkerRepository health check failed:', error);
      return false;
    }
  }

  /**
   * Convert pool worker to domain WorkerThread
   * Note: poolWorker is from workerManagement domain (WorkerThread entity)
   * which has different property names than tradeRouter domain
   */
  private poolWorkerToDomain(poolWorker: any): WorkerThread {
    // Map workerManagement WorkerThread properties to tradeRouter WorkerThread
    // workerManagement uses: workerId, state, assignedSymbols
    // tradeRouter uses: id, status, symbolsOwned
    const workerId = poolWorker.workerId || poolWorker.id;
    const status = poolWorker.state || poolWorker.status || 'initializing';

    const worker = new WorkerThread(
      workerId,
      'footprint_processor',
      status as any
    );

    // Restore symbol ownership if available
    // workerManagement uses assignedSymbols array, tradeRouter uses symbolsOwned Set
    if (poolWorker.assignedSymbols) {
      worker.symbolsOwned = new Set(poolWorker.assignedSymbols);
    }

    // Restore health metrics if available
    if (poolWorker.healthMetrics) {
      worker.healthMetrics = {
        lastHeartbeat: poolWorker.healthMetrics.lastHeartbeat || new Date(),
        activeConnections: poolWorker.healthMetrics.activeConnections || 0,
        messageQueueSize: poolWorker.healthMetrics.messageQueueSize || 0,
        symbolsProcessedThisMinute:
          poolWorker.healthMetrics.symbolsProcessedThisMinute || 0,
        averageProcessingTime:
          poolWorker.healthMetrics.averageProcessingTimeMs ||
          poolWorker.healthMetrics.averageProcessingTime ||
          0,
        memoryUsage:
          poolWorker.healthMetrics.memoryUsageBytes ||
          poolWorker.healthMetrics.memoryUsage ||
          0,
        cpuUsage: poolWorker.healthMetrics.cpuUsage || 0,
      };
    }

    return worker;
  }

  /**
   * Map WorkerStatus enum to string for API compatibility
   */
  private mapWorkerStatusToString(
    status: string
  ): 'active' | 'idle' | 'busy' | 'error' {
    switch (status) {
      case 'ready':
        return 'idle';
      case 'busy':
        return 'busy';
      case 'error':
        return 'error';
      default:
        return 'active';
    }
  }
}
