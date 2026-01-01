/**
 * Candle Processing Infrastructure Adapters
 *
 * Exports all adapter implementations for the candleProcessing feature.
 * All adapters are now unified implementations that work across all contexts.
 */

// Unified adapters (flat structure)
export { CandleStorage } from './CandleStorage.js';
export { SymbolConfigAdapter } from './SymbolConfigAdapter.js';
export { HybridEventPublisher } from './HybridEventPublisher.js';
export {
  IPCStatePersistenceAdapter,
  type IPCStatePersistenceConfig,
} from './IPCStatePersistenceAdapter.js';
export {
  IPCGapPersistenceAdapter,
  type IPCGapPersistenceConfig,
} from './IPCGapPersistenceAdapter.js';
