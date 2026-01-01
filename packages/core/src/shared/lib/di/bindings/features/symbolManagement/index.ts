/**
 * SymbolManagement Feature DI Module
 *
 * Public API for SymbolManagement dependency injection configuration.
 * This is a main-thread-only feature that manages trading symbols and
 * worker assignments.
 *
 * ## Main Thread Only
 * SymbolManagement runs exclusively on the main thread and is responsible for:
 * - Syncing symbols from exchanges via cron jobs
 * - Managing symbol activation/deactivation
 * - Assigning symbols to worker threads
 * - Tracking worker assignments
 *
 * Use `configureSymbolManagement()` to configure all bindings with unified
 * repository pattern that automatically detects the platform at runtime.
 *
 * ## Services Available
 *
 * ### Application Services (Inbound Ports)
 * - SymbolManagementService: Main application service for symbol operations
 * - WorkerAssignmentService: Service for managing worker assignments
 *
 * ### Use Cases
 * - SyncSymbolsFromExchangeUseCase: Sync symbols from exchange APIs
 * - ActivateSymbolUseCase: Activate a symbol for trading
 * - DeactivateSymbolUseCase: Deactivate a symbol
 * - AssignSymbolToWorkerUseCase: Assign symbol to worker thread
 * - FindAssignmentsByWorkerUseCase: Query assignments by worker ID
 * - FindAssignmentsByExchangeUseCase: Query assignments by exchange
 * - GetAssignmentUseCase: Get assignment by ID
 * - RemoveAssignmentUseCase: Remove worker assignment
 *
 * ### Infrastructure
 * - DrizzleSymbolRepository: Unified symbol persistence with runtime schema selection
 * - WorkerAssignmentRepository: Worker assignment persistence
 * Note: Exchange API clients moved to exchangeManagement feature
 * - SymbolSyncCronJob: Cron job for periodic symbol synchronization
 *
 * ## Unified Repository Pattern
 *
 * The DrizzleSymbolRepository uses SQLite for all deployments:
 * - Uses SQLite schema and data types
 * - Same business logic for all platforms
 *
 * @example
 * ```typescript
 * import { configureSymbolManagement } from './bindings/features/symbolManagement/index.js';
 *
 * // Main thread - Unified (auto-detects platform)
 * const container = new Container();
 * configureSymbolManagement(container);
 * ```
 *
 */

import { Container } from 'inversify';
import { configureSymbolManagementCore } from './bindings.js';

/**
 * Configure SymbolManagement with unified repository pattern
 *
 * This function configures all bindings for the SymbolManagement feature,
 * including core services, use cases, and unified adapters that automatically
 * detect the platform at runtime.
 *
 * @param container - InversifyJS container
 */
export function configureSymbolManagement(container: Container): void {
  // Bind core logic with unified repository pattern
  configureSymbolManagementCore(container);
}

// Export types
export { SYMBOL_MANAGEMENT_TYPES } from './types.js';

// Export individual configuration functions for advanced use cases
export { configureSymbolManagementCore } from './bindings.js';
