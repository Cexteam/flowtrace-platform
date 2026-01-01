/**
 * Market Data Infrastructure Adapters
 *
 * Exports all adapter implementations for the marketData feature.
 *
 * NOTE: NoOpSnapshotPersistenceAdapter has been removed - gap detection
 * is now handled in worker thread by ProcessTradeUseCase.
 */

export { BinanceWsTradeStreamAdapter } from './BinanceWebSocketAdapter.js';
export { BinanceRestApiGapRecoveryAdapter } from './BinanceRestApiGapRecoveryAdapter.js';
