/**
 * Health DI Types
 * Separated to avoid circular dependencies.
 */

export const HEALTH_TYPES = {
  Config: Symbol.for('Config'),
  HealthCheckConfig: Symbol.for('HealthCheckConfig'),
  HealthCheckServer: Symbol.for('HealthCheckServer'),
  HealthStatusProvider: Symbol.for('HealthStatusProvider'),
} as const;
