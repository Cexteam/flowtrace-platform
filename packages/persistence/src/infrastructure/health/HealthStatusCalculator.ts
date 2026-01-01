/**
 * HealthStatusCalculator
 *
 * Calculates health status based on component states.
 * Separated from DI module for better testability and maintainability.
 */

import { injectable, inject } from 'inversify';
import type { IPCServer, RuntimeDBPoller } from '@flowtrace/ipc';
import type { HealthStatus, HealthStatusProvider } from './types.js';
import { IPC_TYPES } from '../ipc/di/module.js';

@injectable()
export class HealthStatusCalculator implements HealthStatusProvider {
  constructor(
    @inject(IPC_TYPES.UnixSocketServer)
    private readonly unixSocketServer: IPCServer,
    @inject(IPC_TYPES.RuntimeDatabasePoller)
    private readonly runtimeDatabasePoller: RuntimeDBPoller
  ) {}

  /**
   * Calculate current health status based on component states
   */
  getStatus(): HealthStatus {
    const unixSocketUp = this.unixSocketServer.isListening();
    const queuePollerUp = this.runtimeDatabasePoller.isRunning();
    const storageUp = true; // TODO: Add actual storage health check

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (unixSocketUp && queuePollerUp && storageUp) {
      status = 'healthy';
    } else if (queuePollerUp && storageUp) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      timestamp: Date.now(),
      components: {
        unixSocket: {
          status: unixSocketUp ? 'up' : 'down',
          listening: unixSocketUp,
        },
        queuePoller: {
          status: queuePollerUp ? 'up' : 'down',
          running: queuePollerUp,
        },
        storage: {
          status: storageUp ? 'up' : 'down',
          accessible: storageUp,
        },
      },
    };
  }
}
