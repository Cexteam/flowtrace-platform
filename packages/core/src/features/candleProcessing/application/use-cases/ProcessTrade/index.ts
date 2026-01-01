/**
 * ProcessTrade Use Case Index
 * Export use case and DTOs
 */

export { ProcessTradeUseCase } from './ProcessTradeUseCase.js';
export {
  ProcessTradeRequest,
  ProcessTradeResult,
  GapDetectionResult,
} from './DTO.js';

// Re-export DI types from centralized location (types file to avoid infrastructure dependencies)
export { CANDLE_PROCESSING_TYPES } from '../../../../../shared/lib/di/core/types.js';
