/**
 * HealthCheckServer
 * HTTP server for health check endpoints.
 * Provides status information for orchestration systems.
 */

import { injectable, inject } from 'inversify';
import * as http from 'http';
import type { HealthCheckConfig, HealthStatusProvider } from './types.js';
import { HEALTH_TYPES } from './di/types.js';
import { LOGGER_TYPES } from '../logger/di/types.js';

@injectable()
export class HealthCheckServer {
  private server: http.Server | null = null;
  private running: boolean = false;
  private readonly port: number;

  constructor(
    @inject(HEALTH_TYPES.HealthCheckConfig)
    private _config: HealthCheckConfig,
    @inject(LOGGER_TYPES.Logger)
    private _logger: any,
    @inject(HEALTH_TYPES.HealthStatusProvider)
    private _statusProvider: HealthStatusProvider
  ) {
    this.port = _config.port;
  }

  /**
   * Start health check HTTP server
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Health check server is already running');
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (error) => {
        this._logger.error('Health check server error', error);
        reject(error);
      });

      this.server.listen(this.port, () => {
        this.running = true;
        this._logger.info('Health check server started', { port: this.port });
        resolve();
      });
    });
  }

  /**
   * Stop health check HTTP server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server!.close((error) => {
        if (error) {
          this._logger.error('Error stopping health check server', error);
          reject(error);
        } else {
          this.running = false;
          this.server = null;
          this._logger.info('Health check server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Handle incoming HTTP request
   */
  private handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    // Only handle GET requests to /health
    if (req.method !== 'GET' || req.url !== '/health') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    try {
      const healthStatus = this._statusProvider.getStatus();

      // Determine HTTP status code based on health status
      let statusCode = 200;
      if (healthStatus.status === 'degraded') {
        statusCode = 200; // Still operational, but degraded
      } else if (healthStatus.status === 'unhealthy') {
        statusCode = 503; // Service unavailable
      }

      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(healthStatus, null, 2));

      this._logger.debug('Health check request handled', {
        status: healthStatus.status,
        statusCode,
      });
    } catch (error) {
      this._logger.error('Error generating health status', error);

      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'unhealthy',
          error: 'Failed to generate health status',
          timestamp: Date.now(),
        })
      );
    }
  }
}
