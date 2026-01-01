/**
 * CandleProcessing Infrastructure Layer Index
 *
 * Exports infrastructure adapters and DI module configuration.
 *
 */

// Adapters
export {
  // Unified adapters (replaces all context-specific implementations)
  HybridEventPublisher,
  CandleStorage,
  SymbolConfigAdapter,
} from './adapters/index.js';

// Candle persistence is now handled via StatePersistenceService and IPC.

// DI Module is exported from shared/lib/di/modules/candleProcessing
// This follows the project pattern of centralizing DI configuration
