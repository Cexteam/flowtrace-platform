/**
 * Logger Configuration Bindings
 *
 * Configures logger bindings for application-wide logging.
 * Logger configuration is shared across all deployments.
 *
 */

import { Container } from 'inversify';
import { CORE_TYPES } from '../../core/types.js';
import { LoggerService, createLogger } from '../../../logger/logger.js';

/**
 * Configure logger bindings
 *
 * @param container - InversifyJS container
 */
export function configureLoggerBindings(container: Container): void {
  // Create a default logger instance for the application
  const defaultLogger = createLogger('Application');

  container
    .bind<LoggerService>(CORE_TYPES.Logger)
    .toConstantValue(defaultLogger);
}
