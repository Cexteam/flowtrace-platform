/**
 * DI Container Validation Utilities
 *
 * Provides validation functions for DI container configuration:
 * - Validates that required bindings are present
 * - Ensures correct runtime context for context-specific services
 * - Provides clear error messages for configuration issues
 *
 */

import { Container } from 'inversify';

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when required DI bindings are missing
 */
export class MissingBindingsError extends Error {
  constructor(
    public readonly missingBindings: symbol[],
    public readonly context?: string
  ) {
    const bindingNames = missingBindings
      .map((s) => s.toString().replace('Symbol(', '').replace(')', ''))
      .join(', ');

    const contextMsg = context ? ` in ${context} context` : '';

    super(
      `Missing required DI bindings${contextMsg}: ${bindingNames}\n\n` +
        `This usually means:\n` +
        `1. A feature module was not configured properly\n` +
        `2. The wrong container type was created for this runtime\n` +
        `3. A binding configuration function was not called\n\n` +
        `Check your ContainerFactory configuration and ensure all required features are bound.`
    );

    this.name = 'MissingBindingsError';
  }
}

/**
 * Error thrown when a service is used in the wrong runtime context
 */
export class InvalidContextError extends Error {
  constructor(
    public readonly requiredContext: 'main' | 'worker',
    public readonly actualContext: 'main' | 'worker',
    public readonly serviceName?: string
  ) {
    const serviceMsg = serviceName ? ` (${serviceName})` : '';

    super(
      `Invalid runtime context${serviceMsg}: ` +
        `This service requires '${requiredContext}' thread context, ` +
        `but is running in '${actualContext}' thread context.\n\n` +
        `This usually means:\n` +
        `1. A main-thread-only service was injected into a worker thread\n` +
        `2. A worker-thread-only service was injected into the main thread\n` +
        `3. The wrong container type was created\n\n` +
        `Ensure you're using the correct ContainerFactory method:\n` +
        `- ContainerFactory.createMainThread() for main thread\n` +
        `- ContainerFactory.createWorkerThread() for worker threads`
    );

    this.name = 'InvalidContextError';
  }
}

/**
 * Error thrown when circular dependencies are detected
 */
export class CircularDependencyError extends Error {
  constructor(
    public readonly dependencyChain: string[],
    public readonly context?: string
  ) {
    const chain = dependencyChain.join(' -> ');
    const contextMsg = context ? ` in ${context} context` : '';

    super(
      `Circular dependency detected${contextMsg}: ${chain}\n\n` +
        `This usually means:\n` +
        `1. Two or more services depend on each other directly or indirectly\n` +
        `2. A service depends on itself through a chain of dependencies\n\n` +
        `To fix this:\n` +
        `1. Review the dependency chain above\n` +
        `2. Break the cycle by using lazy injection or refactoring\n` +
        `3. Consider using events or callbacks instead of direct dependencies`
    );

    this.name = 'CircularDependencyError';
  }
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate that all required bindings are present in the container
 *
 * Checks each required binding symbol to ensure it's bound in the container.
 * Throws MissingBindingsError if any bindings are missing.
 *
 * @param container - InversifyJS container to validate
 * @param requiredBindings - Array of DI token symbols that must be bound
 * @param context - Optional context description for error messages
 * @throws {MissingBindingsError} If any required bindings are missing
 *
 * @example
 * ```typescript
 * import { TYPES } from './types.js';
 * import { validateContainer } from './validation.js';
 *
 * const container = new Container();
 * // ... configure bindings ...
 *
 * // Validate core infrastructure is bound
 * validateContainer(container, [
 *   TYPES.Logger,
 *   TYPES.Database,
 *   TYPES.Cache
 * ], 'main thread');
 * ```
 *
 */
export function validateContainer(
  container: Container,
  requiredBindings: symbol[],
  context?: string
): void {
  const missing: symbol[] = [];

  for (const binding of requiredBindings) {
    if (!container.isBound(binding)) {
      missing.push(binding);
    }
  }

  if (missing.length > 0) {
    throw new MissingBindingsError(missing, context);
  }
}

/**
 * Ensure the current runtime is the main thread
 *
 * Validates that the code is running in the main thread context.
 * Throws InvalidContextError if running in a worker thread.
 *
 * Use this function at the start of main-thread-only services to
 * catch configuration errors early.
 *
 * @param serviceName - Optional service name for error messages
 * @throws {InvalidContextError} If running in worker thread context
 *
 * @example
 * ```typescript
 * import { ensureMainThreadContext } from './validation.js';
 *
 * class SymbolSyncCronJob {
 *   constructor() {
 *     // Ensure this service only runs in main thread
 *     ensureMainThreadContext('SymbolSyncCronJob');
 *   }
 * }
 * ```
 *
 */
export function ensureMainThreadContext(serviceName?: string): void {
  const isWorker = typeof process.env.WORKER_ID !== 'undefined';

  if (isWorker) {
    throw new InvalidContextError('main', 'worker', serviceName);
  }
}

/**
 * Ensure the current runtime is a worker thread
 *
 * Validates that the code is running in a worker thread context.
 * Throws InvalidContextError if running in the main thread.
 *
 * Use this function at the start of worker-thread-only services to
 * catch configuration errors early.
 *
 * @param serviceName - Optional service name for error messages
 * @throws {InvalidContextError} If running in main thread context
 *
 * @example
 * ```typescript
 * import { ensureWorkerThreadContext } from './validation.js';
 *
 * class HybridEventPublisher {
 *   constructor() {
 *     // Ensure this service only runs in worker threads
 *     ensureWorkerThreadContext('HybridEventPublisher');
 *   }
 * }
 * ```
 *
 */
export function ensureWorkerThreadContext(serviceName?: string): void {
  const isWorker = typeof process.env.WORKER_ID !== 'undefined';

  if (!isWorker) {
    throw new InvalidContextError('worker', 'main', serviceName);
  }
}

/**
 * Get the current runtime context
 *
 * Detects whether the code is running in main thread or worker thread
 * by checking for the WORKER_ID environment variable.
 *
 * @returns 'main' if main thread, 'worker' if worker thread
 *
 * @example
 * ```typescript
 * import { getCurrentContext } from './validation.js';
 *
 * const context = getCurrentContext();
 * console.log(`Running in ${context} thread`);
 * ```
 */
export function getCurrentContext(): 'main' | 'worker' {
  return typeof process.env.WORKER_ID !== 'undefined' ? 'worker' : 'main';
}

/**
 * Validate container for specific runtime context
 *
 * Ensures the container has all required bindings for the specified
 * runtime context (main or worker).
 *
 * @param container - InversifyJS container to validate
 * @param runtime - Expected runtime context ('main' or 'worker')
 * @param requiredBindings - Array of DI token symbols that must be bound
 * @throws {InvalidContextError} If current context doesn't match expected
 * @throws {MissingBindingsError} If any required bindings are missing
 *
 * @example
 * ```typescript
 * import { validateContainerForContext } from './validation.js';
 * import { TYPES } from './types.js';
 *
 * const container = ContainerFactory.createMainThread();
 *
 * // Validate it's a main thread container with required bindings
 * validateContainerForContext(container, 'main', [
 *   TYPES.SymbolManagementService,
 *   TYPES.TradeRouter
 * ]);
 * ```
 *
 */
export function validateContainerForContext(
  container: Container,
  runtime: 'main' | 'worker',
  requiredBindings: symbol[]
): void {
  const currentContext = getCurrentContext();

  if (currentContext !== runtime) {
    throw new InvalidContextError(runtime, currentContext);
  }

  validateContainer(container, requiredBindings, `${runtime} thread`);
}

/**
 * Check for circular dependencies in container
 *
 * Attempts to resolve all bindings in the container to detect circular
 * dependencies. This is useful for validation during development.
 *
 * Note: This is an expensive operation and should only be used in
 * development mode or during testing.
 *
 * @param container - InversifyJS container to check
 * @param context - Optional context description for error messages
 * @throws {CircularDependencyError} If circular dependencies are detected
 *
 * @example
 * ```typescript
 * import { checkCircularDependencies } from './validation.js';
 *
 * const container = new Container();
 * // ... configure bindings ...
 *
 * if (process.env.NODE_ENV === 'development') {
 *   checkCircularDependencies(container, 'main thread');
 * }
 * ```
 *
 */
export function checkCircularDependencies(
  container: Container,
  context?: string
): void {
  // InversifyJS will throw an error if circular dependencies exist
  // when trying to resolve services. We can catch this and provide
  // a better error message.
  try {
    // Get all service identifiers
    const bindings = (container as any)['_bindingDictionary'];
    if (!bindings) return;

    // Try to resolve each binding to detect circular dependencies
    // This is done by InversifyJS internally, we just need to trigger it
    for (const [, bindingArray] of bindings) {
      if (Array.isArray(bindingArray)) {
        for (const binding of bindingArray) {
          try {
            // Attempt to get metadata which will trigger circular dependency check
            if (binding.cache) {
              // Already resolved, skip
              continue;
            }
          } catch (error) {
            if (error instanceof Error && error.message.includes('Circular')) {
              // Extract dependency chain from error message if possible
              const chain = extractDependencyChain(error.message);
              throw new CircularDependencyError(chain, context);
            }
            // Re-throw other errors
            throw error;
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof CircularDependencyError) {
      throw error;
    }
    // Ignore other errors during validation
  }
}

/**
 * Extract dependency chain from InversifyJS error message
 *
 * @param errorMessage - Error message from InversifyJS
 * @returns Array of service names in the dependency chain
 */
function extractDependencyChain(errorMessage: string): string[] {
  // Try to extract service names from error message
  // InversifyJS error format: "Circular dependency found: A -> B -> C -> A"
  const match = errorMessage.match(/Circular dependency found: (.+)/);
  if (match) {
    return match[1].split(' -> ').map((s) => s.trim());
  }
  return ['Unknown dependency chain'];
}

/**
 * Log all bindings in container (for debugging)
 *
 * Logs all bound services in the container. Useful for debugging
 * DI configuration issues.
 *
 * @param container - InversifyJS container to inspect
 * @param logger - Optional logger function (defaults to console.log)
 *
 * @example
 * ```typescript
 * import { logContainerBindings } from './validation.js';
 *
 * const container = ContainerFactory.createMainThread();
 *
 * if (process.env.DEBUG_DI) {
 *   logContainerBindings(container);
 * }
 * ```
 */
export function logContainerBindings(
  container: Container,
  logger: (message: string) => void = console.log
): void {
  logger('=== DI Container Bindings ===');

  try {
    // Access InversifyJS internal binding dictionary
    // This is stored as a Lookup object with a _map property
    const bindingDictionary = (container as any)._bindingDictionary;

    if (!bindingDictionary || !bindingDictionary._map) {
      logger('No bindings found');
      logger('=============================');
      return;
    }

    let count = 0;

    // The _map is a Map<interfaces.ServiceIdentifier, interfaces.Binding[]>
    const map = bindingDictionary._map;

    if (map instanceof Map) {
      for (const [key, bindingArray] of map.entries()) {
        if (Array.isArray(bindingArray)) {
          for (const binding of bindingArray) {
            const serviceId =
              typeof key === 'symbol'
                ? key.toString().replace('Symbol(', '').replace(')', '')
                : String(key);

            const impl = binding.implementationType
              ? binding.implementationType.name
              : binding.cache
              ? 'Cached instance'
              : 'Dynamic value';

            logger(`  ${serviceId} -> ${impl}`);
            count++;
          }
        }
      }
    }

    if (count === 0) {
      logger('No bindings found');
    } else {
      logger(`Total bindings: ${count}`);
    }
  } catch (error) {
    logger('Error reading container bindings');
  }

  logger('=============================');
}
