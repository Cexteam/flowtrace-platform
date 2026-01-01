/**
 * PersistenceApplication
 * Lifecycle manager for persistence service components.
 * Manages startup and shutdown of UnixSocketServer, RuntimeDatabasePoller, and HealthCheckServer.
 * Uses MessageRouter for centralized message handling.
 *
 * Wiring Strategy (Option C):
 * - DI modules only create instances (no wiring logic)
 * - This Application class wires components in start() method
 * - Benefits: DI modules are pure, wiring is explicit and testable
 */

import { injectable, inject } from 'inversify';
import type { IPCServer, RuntimeDBPoller } from '@flowtrace/ipc';
import type { HealthCheckServer } from '../infrastructure/health/HealthCheckServer.js';
import type { MessageRouter } from '../infrastructure/ipc/MessageRouter.js';
import { LOGGER_TYPES } from '../infrastructure/logger/di/types.js';
import { IPC_TYPES } from '../infrastructure/ipc/di/module.js';
import { HEALTH_TYPES } from '../infrastructure/health/di/types.js';

export interface PersistenceStatus {
  unixSocket: boolean;
  queuePoller: boolean;
  healthCheck: boolean;
}

@injectable()
export class PersistenceApplication {
  private started: boolean = false;

  constructor(
    @inject(IPC_TYPES.UnixSocketServer)
    private _unixSocketServer: IPCServer,
    @inject(IPC_TYPES.RuntimeDatabasePoller)
    private _runtimeDatabasePoller: RuntimeDBPoller,
    @inject(HEALTH_TYPES.HealthCheckServer)
    private _healthCheckServer: HealthCheckServer,
    @inject(IPC_TYPES.MessageRouter) private _messageRouter: MessageRouter,
    @inject(LOGGER_TYPES.Logger) private _logger: any
  ) {}

  /**
   * Start all persistence service components
   *
   * Startup sequence:
   * 1. Wire components - Connect message handlers to servers/pollers
   * 2. Start UnixSocketServer - Primary message channel
   * 3. Start RuntimeDatabasePoller - Fallback message channel
   * 4. Start HealthCheckServer - Monitoring endpoint
   *
   * If any component fails to start, the entire startup fails.
   */
  async start(): Promise<void> {
    if (this.started) {
      throw new Error('PersistenceApplication is already started');
    }

    this._logger.info('Starting PersistenceApplication...');

    try {
      // Wire components - connect message handlers (Option C pattern)
      this._logger.info('Wiring message handlers...');
      this.wireComponents();
      this._logger.info('Message handlers wired successfully');

      // Start Unix Socket Server (primary channel)
      this._logger.info('Starting UnixSocketServer...');
      await this._unixSocketServer.start();
      this._logger.info('UnixSocketServer started successfully');

      // Start RuntimeDatabase Poller (fallback channel)
      this._logger.info('Starting RuntimeDatabasePoller...');
      await this._runtimeDatabasePoller.start();
      this._logger.info('RuntimeDatabasePoller started successfully');

      // Start Health Check Server (monitoring)
      this._logger.info('Starting HealthCheckServer...');
      await this._healthCheckServer.start();
      this._logger.info('HealthCheckServer started successfully');

      this.started = true;
      this._logger.info('PersistenceApplication started successfully', {
        status: this.getStatus(),
        registeredHandlers: this._messageRouter.getRegisteredTypes(),
      });
    } catch (error) {
      this._logger.error('Failed to start PersistenceApplication', error);

      // Attempt to stop any components that were started
      await this.stopSafely();

      throw new Error(
        `Failed to start PersistenceApplication: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Wire components together.
   * Connects message handlers to UnixSocketServer and RuntimeDatabasePoller.
   * This is done here (not in DI) for better separation of concerns.
   */
  private wireComponents(): void {
    // Wire UnixSocketServer to use MessageRouter with request/response pattern
    // This allows clients to receive responses for their requests
    this._unixSocketServer.setRequestHandler(async (message: unknown) => {
      return await this._messageRouter.route(message);
    });

    // Wire RuntimeDatabasePoller to use MessageRouter (fire-and-forget)
    this._runtimeDatabasePoller.setOnMessage(async (message) => {
      await this._messageRouter.route(message);
    });
  }

  /**
   * Stop all persistence service components gracefully
   *
   * Components are stopped in reverse order:
   * 1. HealthCheckServer - Stop accepting health checks
   * 2. RuntimeDatabasePoller - Stop polling queue
   * 3. UnixSocketServer - Stop accepting new messages
   *
   * Ensures in-flight operations complete before exiting.
   */
  async stop(): Promise<void> {
    if (!this.started) {
      this._logger.warn(
        'PersistenceApplication is not started, nothing to stop'
      );
      return;
    }

    this._logger.info('Stopping PersistenceApplication...');

    await this.stopSafely();

    this.started = false;
    this._logger.info('PersistenceApplication stopped successfully');
  }

  /**
   * Get operational status of all components
   */
  getStatus(): PersistenceStatus {
    return {
      unixSocket: this._unixSocketServer.isListening(),
      queuePoller: this._runtimeDatabasePoller.isRunning(),
      healthCheck: this._healthCheckServer.isRunning(),
    };
  }

  /**
   * Get the message router for external access
   */
  getMessageRouter(): MessageRouter {
    return this._messageRouter;
  }

  /**
   * Safely stop all components, catching and logging errors
   * Used during startup failure and normal shutdown
   */
  private async stopSafely(): Promise<void> {
    const errors: Error[] = [];

    // Stop HealthCheckServer
    try {
      if (this._healthCheckServer.isRunning()) {
        this._logger.info('Stopping HealthCheckServer...');
        await this._healthCheckServer.stop();
        this._logger.info('HealthCheckServer stopped');
      }
    } catch (error) {
      this._logger.error('Error stopping HealthCheckServer', error);
      if (error instanceof Error) errors.push(error);
    }

    // Stop RuntimeDatabasePoller
    try {
      if (this._runtimeDatabasePoller.isRunning()) {
        this._logger.info('Stopping RuntimeDatabasePoller...');
        await this._runtimeDatabasePoller.stop();
        this._logger.info('RuntimeDatabasePoller stopped');
      }
    } catch (error) {
      this._logger.error('Error stopping RuntimeDatabasePoller', error);
      if (error instanceof Error) errors.push(error);
    }

    // Stop UnixSocketServer
    try {
      if (this._unixSocketServer.isListening()) {
        this._logger.info('Stopping UnixSocketServer...');
        await this._unixSocketServer.stop();
        this._logger.info('UnixSocketServer stopped');
      }
    } catch (error) {
      this._logger.error('Error stopping UnixSocketServer', error);
      if (error instanceof Error) errors.push(error);
    }

    // If there were errors during shutdown, log them
    if (errors.length > 0) {
      this._logger.warn('Errors occurred during shutdown', {
        errorCount: errors.length,
        errors: errors.map((e) => e.message),
      });
    }
  }
}
