/**
 * Health Check Infrastructure Types
 * Defines interfaces for health check infrastructure components.
 * These are runtime configuration and status interfaces.
 */

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /**
   * HTTP port for health check server
   */
  port: number;
}

/**
 * Health status for a component
 */
export interface ComponentHealthStatus {
  /**
   * Component status
   */
  status: 'up' | 'down';

  /**
   * Additional status details
   */
  [key: string]: unknown;
}

/**
 * Overall health status response
 */
export interface HealthStatus {
  /**
   * Overall service status
   */
  status: 'healthy' | 'degraded' | 'unhealthy';

  /**
   * Timestamp of the health check
   */
  timestamp: number;

  /**
   * Individual component statuses
   */
  components: {
    unixSocket: ComponentHealthStatus;
    queuePoller: ComponentHealthStatus;
    storage: ComponentHealthStatus;
  };
}

/**
 * Health status provider interface
 */
export interface HealthStatusProvider {
  getStatus(): HealthStatus;
}
