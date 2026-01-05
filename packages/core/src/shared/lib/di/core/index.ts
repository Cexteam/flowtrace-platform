/**
 * Core DI Module - Centralized exports for DI infrastructure
 *
 */

// Types
export type { RuntimeType, ContainerConfig } from './types.js';
export {
  TYPES,
  CORE_TYPES,
  MARKET_DATA_TYPES,
  SYMBOL_MANAGEMENT_TYPES,
  CANDLE_PROCESSING_TYPES,
  WORKER_MANAGEMENT_TYPES,
  EXCHANGE_MANAGEMENT_TYPES,
  DATABASE_SYMBOLS,
} from './types.js';

// Container factory
export { ContainerFactory } from './ContainerFactory.js';

// Validation utilities
export {
  validateContainer,
  ensureMainThreadContext,
  ensureWorkerThreadContext,
  getCurrentContext,
  validateContainerForContext,
  checkCircularDependencies,
  logContainerBindings,
  MissingBindingsError,
  InvalidContextError,
  CircularDependencyError,
} from './validation.js';
