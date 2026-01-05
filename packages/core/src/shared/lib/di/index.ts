/**
 * Dependency Injection Module - Public API
 *
 * This module provides a namespace-based DI structure with clear separation between
 * runtime contexts (main thread vs worker thread).
 *
 * ## Architecture Overview
 *
 * The DI system is organized into three layers:
 *
 * 1. **Public API Layer** (this file)
 *    - Exports ContainerFactory for container creation
 *    - Exports MainThread and WorkerThread namespaces for feature configuration
 *    - Exports core types and DI tokens
 *
 * 2. **Context Layer** (MainThread, WorkerThread namespaces)
 *    - MainThread: Exposes all main thread features (SymbolManagement, TradeRouter, etc.)
 *    - WorkerThread: Exposes only worker-compatible features (CandleProcessing)
 *    - Provides compile-time safety - prevents invalid context usage
 *
 * 3. **Binding Layer** (feature modules)
 *    - Each feature manages its own bindings in a self-contained module
 *    - Clear separation between shared logic and context-specific implementations
 *
 * ## Usage Examples
 *
 * ### Using ContainerFactory (Recommended)
 *
 * ```typescript
 * import { ContainerFactory } from '@flowtrace/core/di';
 *
 * // Create main thread container
 * const mainContainer = ContainerFactory.createMainThread();
 *
 * // Create worker thread container
 * const workerContainer = ContainerFactory.createWorkerThread();
 *
 * // Auto-detect runtime from environment
 * const container = ContainerFactory.create();
 * ```
 *
 * ### Using Namespaces Directly (Advanced)
 *
 * ```typescript
 * import { Container } from 'inversify';
 * import { MainThread, WorkerThread } from '@flowtrace/core/di';
 *
 * // Configure specific features for main thread
 * const mainContainer = new Container();
 * MainThread.configureCandleProcessing(mainContainer);
 * MainThread.configureSymbolManagement(mainContainer);
 *
 * // Configure features for worker thread
 * const workerContainer = new Container();
 * WorkerThread.configureCandleProcessing(workerContainer);
 * ```
 *
 * ### Resolving Services
 *
 * ```typescript
 * import { TYPES } from '@flowtrace/core/di';
 *
 * // Resolve services from container
 * const logger = container.get(TYPES.Logger);
 * const database = container.get(TYPES.Database);
 * const candleService = container.get(TYPES.CandleProcessingService);
 * ```
 *
 * ## Key Design Principles
 *
 * 1. **Namespace Isolation**: Main thread and worker thread bindings are exposed through
 *    separate namespaces, preventing accidental misconfiguration
 *
 * 2. **Feature Independence**: Each feature manages its own bindings in a self-contained
 *    module with clear public API
 *
 * 3. **Type Safety**: TypeScript enforces valid runtime combinations at compile time
 *
 * 4. **Discoverability**: IDE autocomplete reveals available features for each context
 *
 * ## Runtime Contexts
 *
 * ### Main Thread
 * - Manages application lifecycle and orchestration
 * - Handles database persistence and caching
 * - Manages worker pool and trade routing
 * - Ingests market data from exchanges
 * - Synchronizes trading symbols
 *
 * Available features:
 * - CandleProcessing (aggregation role)
 * - SymbolManagement
 * - TradeRouter
 * - WorkerManagement
 * - MarketData
 * - ExchangeManagement
 *
 * ### Worker Thread
 * - Processes trades and calculates footprints
 * - Aggregates candles across timeframes
 * - Publishes completed candles to main thread
 * - Minimal feature set for performance
 *
 * Available features:
 * - CandleProcessing (processing role)
 *
 */

// ============================================================================
// Core Types - Runtime and Platform Configuration
// ============================================================================

/**
 * Runtime execution context type
 * - 'main': Main thread (app.ts entry point)
 * - 'worker': Worker thread (worker.ts entry point)
 */
export type { RuntimeType, ContainerConfig } from './core/types.js';

// ============================================================================
// DI Tokens - Symbols for Service Resolution
// ============================================================================

/**
 * Unified DI token registry
 *
 * Contains all DI symbols for service resolution across the application.
 * Organized by feature domain for clarity.
 *
 * @example
 * ```typescript
 * import { TYPES } from '@flowtrace/core/di';
 *
 * // Core infrastructure
 * const logger = container.get(TYPES.Logger);
 * const database = container.get(TYPES.Database);
 *
 * // Feature services
 * const candleService = container.get(TYPES.CandleProcessingService);
 * const symbolService = container.get(TYPES.SymbolManagementService);
 * ```
 */
export {
  TYPES,
  CORE_TYPES,
  MARKET_DATA_TYPES,
  SYMBOL_MANAGEMENT_TYPES,
  CANDLE_PROCESSING_TYPES,
  WORKER_MANAGEMENT_TYPES,
  EXCHANGE_MANAGEMENT_TYPES,
  DATABASE_SYMBOLS,
} from './core/types.js';

// ============================================================================
// Runtime Utilities - Context Detection
// ============================================================================

/**
 * Runtime context detection utilities
 *
 * Helper functions to determine current execution context at runtime.
 * Useful for conditional logic based on thread type.
 *
 * @example
 * ```typescript
 * import { getCurrentContext } from '@flowtrace/core/di';
 *
 * const context = getCurrentContext(); // 'main' | 'worker'
 * if (context === 'worker') {
 *   console.log('Running in worker thread');
 * }
 * ```
 */
export {
  getCurrentContext,
  ensureMainThreadContext,
  ensureWorkerThreadContext,
} from './core/validation.js';

// ============================================================================
// Container Factory - Primary Container Creation API
// ============================================================================

/**
 * ContainerFactory - Static factory for creating DI containers
 *
 * Provides centralized container creation with runtime-specific bindings.
 *
 * ## Methods
 *
 * - `createMainThread()`: Create main thread container with all features
 * - `createWorkerThread()`: Create worker thread container with minimal features
 * - `create()`: Auto-detect runtime from environment
 * - `clearCache()`: Clear container cache (for testing)
 *
 * @example
 * ```typescript
 * import { ContainerFactory } from '@flowtrace/core/di';
 *
 * const mainContainer = ContainerFactory.createMainThread();
 * const workerContainer = ContainerFactory.createWorkerThread();
 * const container = ContainerFactory.create(); // Auto-detect
 * ```
 */
export { ContainerFactory } from './core/ContainerFactory.js';

// ============================================================================
// Context Namespaces - Feature Configuration APIs
// ============================================================================

/**
 * MainThread namespace - Configuration functions for main thread context
 *
 * Exposes all features available in main thread context. Main thread is responsible
 * for application orchestration, database persistence, worker management, and
 * external service integration.
 *
 * ## Available Features
 *
 * - **CandleProcessing**: Aggregates candle data from workers, persists to database
 * - **SymbolManagement**: Manages trading symbols and synchronization with exchanges
 * - **TradeRouter**: Routes incoming trades to appropriate worker threads
 * - **WorkerManagement**: Manages worker pool lifecycle and health monitoring
 * - **MarketData**: Ingests trade data from exchange WebSocket connections
 * - **ExchangeManagement**: Manages exchange configurations and API clients
 *
 * ## Usage
 *
 * Each feature can be configured independently by calling its configuration function.
 *
 * @example
 * ```typescript
 * import { Container } from 'inversify';
 * import { MainThread } from '@flowtrace/core/di';
 *
 * const container = new Container();
 *
 * // Configure all main thread features
 * MainThread.configureCandleProcessing(container);
 * MainThread.configureSymbolManagement(container);
 * MainThread.configureTradeRouter(container);
 * MainThread.configureWorkerManagement(container);
 * MainThread.configureMarketData(container);
 * MainThread.configureExchangeManagement(container);
 * ```
 *
 */
export { MainThread } from './contexts/main.js';

/**
 * WorkerThread namespace - Configuration functions for worker thread context
 *
 * Exposes only worker-compatible features. Worker threads are designed to be
 * lightweight and focused on compute-intensive tasks like trade processing and
 * footprint calculation.
 *
 * ## Available Features
 *
 * - **CandleProcessing**: Processes trades, calculates footprints, publishes events
 *
 * ## Worker Thread Responsibilities
 *
 * Worker threads are background processes that:
 * 1. Receive trade data from main thread via IPC
 * 2. Process trades and calculate footprints using domain logic
 * 3. Aggregate candles across multiple timeframes
 * 4. Publish completed candles back to main thread
 *
 * ## Compile-Time Safety
 *
 * TypeScript prevents calling main-only features from worker context. The WorkerThread
 * namespace only exposes worker-compatible configuration functions. Attempting to
 * configure main-only features will result in a compile-time error.
 *
 * @example
 * ```typescript
 * import { Container } from 'inversify';
 * import { WorkerThread } from '@flowtrace/core/di';
 *
 * const container = new Container();
 *
 * // Valid - CandleProcessing is worker-compatible
 * WorkerThread.configureCandleProcessing(container);
 *
 * // Invalid - Compile-time error (property does not exist)
 * // WorkerThread.configureSymbolManagement(container);
 * // WorkerThread.configureTradeRouter(container);
 * ```
 *
 * ## Performance Considerations
 *
 * Worker containers are intentionally minimal to:
 * - Reduce memory footprint per worker
 * - Enable faster worker startup time
 * - Allow horizontal scaling of worker pools
 * - Minimize inter-process communication overhead
 *
 */
export { WorkerThread } from './contexts/worker.js';

// ============================================================================
// InversifyJS Container Type - For Type Annotations
// ============================================================================

/**
 * InversifyJS Container type
 *
 * Re-exported from inversify for convenience. Use this type for function
 * parameters and return types when working with DI containers.
 *
 * @example
 * ```typescript
 * import { Container } from '@flowtrace/core/di';
 *
 * function configureCustomFeature(container: Container): void {
 *   container.bind(TYPES.CustomService).to(CustomServiceImpl);
 * }
 * ```
 */
export type { Container } from 'inversify';

// ============================================================================
// Validation Utilities - Container Validation and Error Handling
// ============================================================================

/**
 * Container validation utilities
 *
 * Provides functions for validating DI container configuration and ensuring
 * correct runtime context usage. These utilities help catch configuration
 * errors early and provide clear error messages.
 *
 * ## Validation Functions
 *
 * - `validateContainer()`: Validate that required bindings are present
 * - `ensureMainThreadContext()`: Ensure code is running in main thread
 * - `ensureWorkerThreadContext()`: Ensure code is running in worker thread
 * - `getCurrentContext()`: Get current runtime context
 * - `validateContainerForContext()`: Validate container for specific context
 * - `checkCircularDependencies()`: Check for circular dependencies (dev mode)
 * - `logContainerBindings()`: Log all bindings for debugging
 *
 * ## Error Classes
 *
 * - `MissingBindingsError`: Thrown when required bindings are missing
 * - `InvalidContextError`: Thrown when service is used in wrong context
 * - `CircularDependencyError`: Thrown when circular dependencies detected
 *
 * @example
 * ```typescript
 * import {
 *   validateContainer,
 *   ensureMainThreadContext,
 *   TYPES
 * } from '@flowtrace/core/di';
 *
 * // Validate container has required bindings
 * validateContainer(container, [
 *   TYPES.Logger,
 *   TYPES.Database,
 *   TYPES.Cache
 * ], 'main thread');
 *
 * // Ensure service only runs in main thread
 * class SymbolSyncCronJob {
 *   constructor() {
 *     ensureMainThreadContext('SymbolSyncCronJob');
 *   }
 * }
 * ```
 *
 */
export {
  validateContainer,
  validateContainerForContext,
  checkCircularDependencies,
  logContainerBindings,
  MissingBindingsError,
  InvalidContextError,
  CircularDependencyError,
} from './core/validation.js';
