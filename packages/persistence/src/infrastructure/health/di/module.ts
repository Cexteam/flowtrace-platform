/**
 * Health DI Module
 * Infrastructure-centric DI module for health check infrastructure.
 */

import { Container } from 'inversify';

import type { PersistenceBootstrapConfig } from '../../../bootstrap.js';
import { HealthCheckServer } from '../HealthCheckServer.js';
import { HealthStatusCalculator } from '../HealthStatusCalculator.js';
import type { HealthCheckConfig, HealthStatusProvider } from '../types.js';
import { HEALTH_TYPES } from './types.js';

// Re-export for backward compatibility
export { HEALTH_TYPES } from './types.js';

// =============================================================================
// Binding Registration
// =============================================================================

/**
 * Register all health-related bindings including config and health check components.
 */
export function registerHealthBindings(
  container: Container,
  config: PersistenceBootstrapConfig
): void {
  // Config bindings
  container
    .bind<PersistenceBootstrapConfig>(HEALTH_TYPES.Config)
    .toConstantValue(config);

  container
    .bind<HealthCheckConfig>(HEALTH_TYPES.HealthCheckConfig)
    .toConstantValue({ port: config.healthCheckPort ?? 3001 });

  // HealthStatusProvider - uses HealthStatusCalculator class
  container
    .bind<HealthStatusProvider>(HEALTH_TYPES.HealthStatusProvider)
    .to(HealthStatusCalculator)
    .inSingletonScope();

  // HealthCheckServer
  container
    .bind<HealthCheckServer>(HEALTH_TYPES.HealthCheckServer)
    .to(HealthCheckServer)
    .inSingletonScope();
}
