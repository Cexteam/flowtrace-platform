/**
 * CandleProcessing Application Layer Index
 *
 * Export all ports, services, and use cases.
 * This is the public API for the application layer.
 *
 */

// ============================================================================
// Ports (Interfaces)
// ============================================================================

// Port In - What the application can do
export {
  CandleProcessingPort,
  ProcessTradeRequest,
  ProcessTradeResult,
  InitializeSymbolRequest,
} from './ports/in/index.js';

// Port Out - What the application needs
export {
  EventPublisherPort,
  ProcessingMetrics,
} from './ports/out/EventPublisherPort.js';

export { CandleStoragePort } from './ports/out/CandleStoragePort.js';

export { SymbolConfigPort } from './ports/out/SymbolConfigPort.js';

// ============================================================================
// Use Cases
// ============================================================================

export { ProcessTradeUseCase } from './use-cases/ProcessTrade/index.js';

export { InitializeSymbolUseCase } from './use-cases/InitializeSymbol/index.js';

// ============================================================================
// Services
// ============================================================================

export { CandleProcessingService } from './services/index.js';

// ============================================================================
// DI Types - from centralized location
// Note: Import from types file directly to avoid infrastructure dependencies
// ============================================================================

export { CANDLE_PROCESSING_TYPES } from '../../../shared/lib/di/core/types.js';
