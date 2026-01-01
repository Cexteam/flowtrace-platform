/**
 * Logger DI Module
 * Infrastructure-centric DI module for logger.
 * Logger is a cross-cutting concern used by all modules.
 */

import { Container } from 'inversify';
import { createLogger } from '@flowtrace/core';
import { LOGGER_TYPES, type Logger } from './types.js';

// Re-export for backward compatibility
export { LOGGER_TYPES, type Logger } from './types.js';

// =============================================================================
// Binding Registration
// =============================================================================

export function registerLoggerBindings(container: Container): void {
  const logger = createLogger('Persistence') as Logger;
  container.bind<Logger>(LOGGER_TYPES.Logger).toConstantValue(logger);
}
