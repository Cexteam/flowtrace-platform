/**
 * ExchangeManagement Feature DI Module
 *
 * Public API for ExchangeManagement dependency injection configuration.
 * This is a main-thread-only feature that manages exchange configurations.
 *
 * ## Main Thread Only
 * ExchangeManagement runs exclusively on the main thread and is responsible for:
 * - Managing exchange configurations (API keys, endpoints)
 * - Monitoring exchange health and connectivity
 * - Providing exchange metadata to other features
 * - Validating exchange credentials
 *
 * Use `configureExchangeManagement()` to configure all bindings with
 * unified adapters that automatically detect the platform.
 *
 * ## Services Available
 *
 * ### Application Services (Inbound Ports)
 * - ExchangeManagementService: Main application service for exchange operations
 *
 * ### Infrastructure (Outbound Ports)
 * - ExchangeRepository: Unified exchange persistence with runtime schema selection
 *
 * ## Unified Repository Pattern
 *
 * The ExchangeManagement feature uses a unified repository pattern:
 * - Single `DrizzleExchangeRepository` class for all deployments
 * - Uses SQLite with IPC-based persistence
 * - Same business logic for all platforms
 *
 * @example
 * ```typescript
 * import { configureExchangeManagement } from './bindings/features/exchangeManagement/index.js';
 *
 * // Works for both Desktop and Cloud
 * const container = new Container();
 * configureExchangeManagement(container);
 * ```
 *
 */

// Export types
export { EXCHANGE_MANAGEMENT_TYPES } from './types.js';

// Export main configuration function
export { configureExchangeManagement } from './bindings.js';
