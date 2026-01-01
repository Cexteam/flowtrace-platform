/**
 * FlowTrace Core Bootstrap
 *
 * Entry point for starting the FlowTrace application.
 * Provides a simple `bootstrap()` function that handles all initialization.
 *
 * Usage:
 * ```typescript
 * import { bootstrap } from '@flowtrace/core';
 *
 * const { app, container } = await bootstrap();
 * // App is running...
 * await app.stop();
 * ```
 *
 * @module bootstrap
 */

import { Container } from 'inversify';
import {
  FlowTraceApplication,
  type FlowTraceApplicationOptions,
  type FlowTraceApplicationStatus,
} from './shared/application/FlowTraceApplication.js';
import { ContainerFactory } from './shared/lib/di/core/ContainerFactory.js';
import { TYPES, WORKER_MANAGEMENT_TYPES } from './shared/lib/di/index.js';

/**
 * Bootstrap result containing the running application and DI container
 */
export interface BootstrapResult {
  /** The running FlowTraceApplication instance */
  app: FlowTraceApplication;
  /** The DI container for accessing services */
  container: Container;
}

/**
 * Bootstrap the FlowTrace application
 *
 * Creates DI container, initializes services, and starts the application.
 *
 * @param options - Startup options
 * @returns The running application and DI container
 *
 * @example
 * ```typescript
 * const { app } = await bootstrap();
 * await app.stop();
 * ```
 */
export async function bootstrap(
  options?: FlowTraceApplicationOptions
): Promise<BootstrapResult> {
  // Create DI container
  const container = ContainerFactory.createMainThread();

  // Get application instance
  const app = container.get<FlowTraceApplication>(TYPES.FlowTraceApplication);

  // Set container reference for database operations
  app.setContainer(container);

  // Start all services
  await app.start(options);

  return { app, container };
}

// Re-export for advanced usage
export {
  FlowTraceApplication,
  type FlowTraceApplicationOptions,
  type FlowTraceApplicationStatus,
} from './shared/application/FlowTraceApplication.js';

export { ContainerFactory } from './shared/lib/di/core/ContainerFactory.js';
export { TYPES, WORKER_MANAGEMENT_TYPES } from './shared/lib/di/index.js';
