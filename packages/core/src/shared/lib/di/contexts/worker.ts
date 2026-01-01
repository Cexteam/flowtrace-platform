/**
 * WorkerThread namespace - Configuration functions for worker thread context
 *
 * Available features:
 * - CandleProcessing: Processes trades and calculates footprints
 *
 * Note: Workers have minimal features for performance. Worker threads are designed
 * to be lightweight and focused on compute-intensive tasks like trade processing
 * and footprint calculation. Main-thread-only features (SymbolManagement, TradeRouter,
 * WorkerManagement, MarketData, ExchangeManagement) are NOT available in worker context.
 *
 * ## Worker Thread Responsibilities
 *
 * Worker threads are background processes that:
 * 1. Receive trade data from the main thread via IPC
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
 * import { WorkerThread } from '@flowtrace/core/di';
 *
 * // Valid - CandleProcessing is worker-compatible
 * const container = new Container();
 * WorkerThread.configureCandleProcessing(container);
 *
 * // Invalid - Compile-time error (property does not exist)
 * // WorkerThread.configureSymbolManagement(container);
 * ```
 *
 */

import { Container } from 'inversify';
import { configureCandleProcessingWorker } from '../bindings/features/candleProcessing/index.js';

/**
 * WorkerThread namespace
 * Exposes all features available in worker thread context
 *
 * This namespace is intentionally minimal to keep worker threads lightweight
 * and focused on their core responsibility: processing trades and calculating
 * footprints.
 */
export namespace WorkerThread {
  /**
   * Configure CandleProcessing for worker thread
   *
   * Worker thread role: Process trades, calculate footprints, publish events
   *
   * Services bound:
   * - FootprintCalculator: Pure function service for footprint calculations
   * - TimeframeRollup: Pure function service for timeframe rollup
   * - ProcessTradeUseCase: Application use case for processing trades
   * - InitializeSymbolUseCase: Application use case for initializing symbols
   * - CandleProcessingService: Main application service
   * - WorkerCandleStorage: In-memory storage for worker thread
   * - HybridEventPublisher: Event publisher with Unix Socket + SQLite Queue fallback
   * - WorkerSymbolConfig: Symbol configuration for worker thread
   *
   * ## Worker-Specific Behavior
   *
   * Unlike the main thread, workers:
   * - Do NOT persist candles to database (main thread handles persistence)
   * - Do NOT manage symbol synchronization (main thread handles this)
   * - Do NOT route trades (main thread handles routing)
   * - Focus exclusively on compute-intensive trade processing
   *
   * ## Performance Considerations
   *
   * Worker containers are intentionally minimal to:
   * - Reduce memory footprint per worker
   * - Enable faster worker startup time
   * - Allow horizontal scaling of worker pools
   * - Minimize inter-process communication overhead
   *
   * @param container - InversifyJS container
   */
  export function configureCandleProcessing(container: Container): void {
    configureCandleProcessingWorker(container);
  }
}
