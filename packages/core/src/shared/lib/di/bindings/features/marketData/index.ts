/**
 * MarketData Feature DI Module
 *
 * Public API for MarketData dependency injection configuration.
 * This is a main-thread-only feature that manages market data ingestion.
 *
 * NOTE: SnapshotPersistencePort and TradeRepository have been removed.
 * Gap detection is now handled in worker thread by ProcessTradeUseCase.
 * Trade/candle persistence is handled via @flowtrace/persistence through IPC.
 *
 * ## Main Thread Only
 * MarketData runs exclusively on the main thread and is responsible for:
 * - Connecting to exchange WebSocket feeds
 * - Ingesting real-time trade data
 * - Managing symbol subscriptions
 * - Recovering missing data via REST API
 *
 * Use `configureMarketData()` to configure all bindings.
 *
 * ## Services Available
 *
 * ### Application Services (Inbound Ports)
 * - TradeIngestionService: Main trade ingestion orchestrator
 *
 * ### Use Cases
 * - AddSymbolsToIngestionUseCase: Add symbols to WebSocket subscription
 * - RemoveSymbolsFromIngestionUseCase: Remove symbols from subscription
 * - GapRecoveryUseCase: Recover missing trade data via REST API
 *
 * ### Infrastructure (Outbound Ports)
 * - TradeStreamPort: WebSocket trade stream adapter (Binance)
 * - RestApiGapRecoveryPort: REST API gap recovery adapter (Binance)
 *
 */

import { Container } from 'inversify';
import { configureMarketDataCore } from './bindings.js';

/**
 * Configure MarketData bindings
 *
 * This function configures all bindings for the MarketData feature.
 *
 * @param container - InversifyJS container
 */
export function configureMarketData(container: Container): void {
  configureMarketDataCore(container);
}

// Export types
export { MARKET_DATA_TYPES } from './types.js';

// Export individual configuration functions for advanced use cases
export { configureMarketDataCore } from './bindings.js';
