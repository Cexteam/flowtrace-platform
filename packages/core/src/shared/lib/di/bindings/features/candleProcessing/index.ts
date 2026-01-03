/**
 * CandleProcessing Feature DI Module
 *
 * Public API for CandleProcessing dependency injection configuration.
 * This feature supports both main and worker thread contexts.
 *
 * ## Main Thread Role
 * The main thread aggregates candle data from workers and persists to database.
 * Use `configureCandleProcessingMain()` to configure main thread bindings.
 *
 * Services available in main thread:
 * - ProcessTradeUseCase: Application use case for processing trades
 * - InitializeSymbolUseCase: Application use case for initializing symbols
 * - CandleProcessingService: Main application service
 * - MainThreadCandleStorage: In-memory storage for main thread
 * - HybridEventPublisher: Event publisher with Unix Socket + SQLite Queue fallback
 * - CandleRepository: Database persistence (unified with runtime schema selection)
 *
 * ## Worker Thread Role
 * Worker threads process trades, calculate footprints, and publish events.
 * Use `configureCandleProcessingWorker()` to configure worker thread bindings.
 *
 * Services available in worker thread:
 * - ProcessTradeUseCase: Application use case for processing trades
 * - InitializeSymbolUseCase: Application use case for initializing symbols
 * - CandleProcessingService: Main application service
 * - WorkerCandleStorage: In-memory storage for worker thread
 * - HybridEventPublisher: Event publisher with Unix Socket + SQLite Queue fallback
 * - WorkerSymbolConfig: Symbol configuration for worker thread
 *
 * ## Platform Differences
 *
 * the unified architecture refactor. All deployments now use the same
 * configuration with IPC-based persistence.
 *
 * - Uses SQLite schema for local database
 * - Uses IPC for persistence service communication
 * - Uses HybridEventPublisher with Unix Socket + SQLite Queue fallback
 *
 * ## Unified Repository Pattern
 * The CandleRepository uses SQLite for all deployments.
 *
 * @example
 * ```typescript
 * import { configureCandleProcessingMain, configureCandleProcessingWorker } from './bindings/features/candleProcessing/index.js';
 *
 * // Main thread - Auto-detects platform
 * const mainContainer = new Container();
 * configureCandleProcessingMain(mainContainer);
 *
 * // Worker thread - Auto-detects platform
 * const workerContainer = new Container();
 * configureCandleProcessingWorker(workerContainer);
 * ```
 *
 */

// Export configuration functions
export { configureCandleProcessingMain } from './main.js';
export { configureCandleProcessingWorker } from './worker.js';
export { configureCandleProcessingShared } from './shared.js';

// Export types
export { CANDLE_PROCESSING_TYPES } from './types.js';
