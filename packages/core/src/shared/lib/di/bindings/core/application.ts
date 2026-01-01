/**
 * Application Lifecycle Bindings
 *
 * Configures FlowTraceApplication binding - the main thread orchestrator
 * that manages application lifecycle, coordinates features, and handles
 * graceful shutdown.
 *
 * This is a cross-cutting service that orchestrates multiple features.
 *
 */

import { Container } from 'inversify';
import { CORE_TYPES } from '../../core/types.js';
import { FlowTraceApplication } from '../../../../application/FlowTraceApplication.js';

/**
 * Configure application lifecycle bindings
 *
 * @param container - InversifyJS container
 */
export function configureApplicationBindings(container: Container): void {
  // FlowTraceApplication orchestrates all features and manages application lifecycle
  container
    .bind<FlowTraceApplication>(CORE_TYPES.FlowTraceApplication)
    .to(FlowTraceApplication)
    .inSingletonScope();
}
