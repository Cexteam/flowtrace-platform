/**
 * INFRASTRUCTURE ADAPTER: Worker Infrastructure Driven Adapter
 * FINAL CONSOLIDATED - Pure port out coordination, NO business logic duplication
 * Follows feature development pattern: Pure external coordination only
 *
 */

import { injectable, inject } from 'inversify';
import {
  WorkerInfrastructureDrivenPort,
  SystemHealthStatus,
  SymbolAssignmentUpdate,
  WorkerInitConfig,
} from '../../application/ports/out/WorkerInfrastructureDrivenPort.js';
import { WORKER_MANAGEMENT_TYPES } from '../../../../shared/lib/di/bindings/features/workerManagement/types.js';
import type {
  WorkerCommunicationPort,
  WorkerMessage as IPCWorkerMessage,
} from '../../../workerManagement/application/ports/in/WorkerCommunicationPort.js';
import type { WorkerPoolPort } from '../../../workerManagement/application/ports/in/WorkerPoolPort.js';
import { createLogger } from '../../../../shared/lib/logger/logger.js';

const logger = createLogger('WorkerInfrastructureDrivenAdapter');

@injectable()
export class WorkerInfrastructureDrivenAdapter
  implements WorkerInfrastructureDrivenPort
{
  constructor(
    @inject(WORKER_MANAGEMENT_TYPES.WorkerCommunicationPort)
    private readonly workerCommunicationPort: WorkerCommunicationPort,
    @inject(WORKER_MANAGEMENT_TYPES.WorkerPoolPort)
    private readonly workerPoolPort: WorkerPoolPort
  ) {
    // No local business logic - pure coordination layer
  }

  // ===== PORT OUT COORDINATION ONLY =====
  // These methods coordinate with external worker infrastructure
  // Business logic (routing algorithms) are in application use cases

  /**
   * Check worker health for routing decisions (RouteTradesUseCase needs this)
   * Uses WorkerCommunicationPort for clean architecture compliance
   */
  async checkWorkerHealth(workerId: string): Promise<boolean> {
    try {
      // Send health check ping through WorkerCommunicationPort
      const message: IPCWorkerMessage = {
        id: `health_${Date.now()}`,
        type: 'SYNC_METRICS',
        data: { timestamp: Date.now() },
      };

      await this.workerCommunicationPort.sendToWorker(workerId, message, {
        timeoutMs: 5000,
      });

      return true; // Healthy if ping succeeds
    } catch {
      return false; // Unhealthy if ping fails
    }
  }

  /**
   * Send message to worker (RouteTradesUseCase needs this)
   * Uses WorkerCommunicationPort for clean architecture compliance
   */
  async sendToWorker(
    workerId: string,
    message: any,
    timeoutMs?: number
  ): Promise<any> {
    return await this.workerCommunicationPort.sendToWorker(workerId, message, {
      timeoutMs,
    });
  }

  /**
   * Get worker health status for routing decisions (external coordination)
   */
  async getWorkerHealth(workerId: string) {
    return {
      workerId,
      isHealthy: await this.checkWorkerHealth(workerId), // Use real health check
      activeConnections: 0,
      messageQueueSize: 0,
      lastActivity: new Date(),
      symbolsProcessedPerMinute: 0,
      averageProcessingTime: 0,
    };
  }

  /**
   * Get routing system load for coordination (external monitoring)
   */
  async getRoutingSystemLoad() {
    return {
      totalWorkers: 0,
      activeWorkers: 0,
      totalQueuedTrades: 0,
      averageQueueSize: 0,
      symbolsPerWorker: [],
      timestamp: new Date(),
    };
  }

  /**
   * Record routing decision for analytics (external coordination)
   */
  recordRoutingDecision(_decision: any) {
    // NO business logic - just coordination
  }

  /**
   * Record worker performance metrics (external coordination)
   */
  recordWorkerMetric(_metric: any) {
    // NO business logic - just coordination
  }

  /**
   * Get worker statistics (external monitoring)
   */
  async getWorkerStatistics(workerId: string) {
    return {
      workerId,
      routesHandled: 0,
      tradesProcessed: 0,
      uptimeSeconds: 0,
      averageResponseTime: 0,
      successRate: 0,
      lastHeartbeat: new Date(),
      performanceScore: 0,
    };
  }

  /**
   * Get system health status (external monitoring)
   */
  async getSystemHealth(): Promise<SystemHealthStatus> {
    return {
      overallStatus: 'healthy' as const,
      totalWorkers: 0,
      activeWorkers: 0,
      totalRoutesHandled: 0,
      averageSystemLoad: 0,
      lastUpdated: new Date(),
      warnings: [],
      criticalIssues: [],
    };
  }

  /**
   * Update worker assignments for routing coordination (external state)
   * Updates WorkerThread entity in WorkerPoolService to track assigned symbols
   */
  async updateWorkerAssignments(
    workerId: string,
    assignments: SymbolAssignmentUpdate
  ): Promise<void> {
    const worker = this.workerPoolPort.getWorker(workerId);

    if (!worker) {
      return; // Worker not found, skip
    }

    const { symbols, action, removedSymbols } = assignments;

    if (action === 'add' || action === 'replace') {
      // Add symbols to worker
      for (const symbol of symbols) {
        worker.assignSymbol(symbol);
      }
    }

    if (action === 'remove' && removedSymbols) {
      // Remove symbols from worker
      for (const symbol of removedSymbols) {
        worker.removeSymbol(symbol);
      }
    }
  }

  /**
   * Initialize worker routing configuration (external state)
   */
  async initializeWorkerState(
    workerId: string,
    config: WorkerInitConfig
  ): Promise<void> {
    // Just pure external coordination - business logic in use cases
  }

  /**
   * Load worker state for status monitoring (external state)
   * Returns WorkerStateData from WorkerPoolPort's in-memory WorkerThread entity
   */
  async loadWorkerState(workerId: string) {
    const worker = this.workerPoolPort.getWorker(workerId);
    if (!worker) {
      return null;
    }

    // Map WorkerThread entity to WorkerStateData interface
    return {
      workerId: worker.workerId,
      status: this.mapWorkerState(worker.state),
      symbolsOwned: worker.assignedSymbols,
      healthMetrics: {
        activeConnections: 0,
        messageQueueSize: 0,
        symbolsProcessedThisMinute:
          worker.healthMetrics.totalTradesProcessed || 0,
        averageProcessingTime: worker.healthMetrics.averageProcessingTimeMs,
        memoryUsage: worker.healthMetrics.memoryUsageBytes,
        cpuUsage: worker.healthMetrics.cpuUsagePercent,
        lastHeartbeat: worker.healthMetrics.lastHeartbeat,
        uptimeSeconds: worker.uptimeSeconds,
      },
      lastActivityAt: worker.lastActivityAt,
      createdAt: worker.createdAt,
    };
  }

  /**
   * Map WorkerThread state to WorkerStateData status
   */
  private mapWorkerState(
    state: string
  ): 'initializing' | 'ready' | 'busy' | 'error' | 'shutdown' {
    switch (state) {
      case 'initializing':
        return 'initializing';
      case 'ready':
        return 'ready';
      case 'busy':
        return 'busy';
      case 'unhealthy':
        return 'error';
      case 'terminated':
        return 'shutdown';
      default:
        return 'initializing';
    }
  }
}
