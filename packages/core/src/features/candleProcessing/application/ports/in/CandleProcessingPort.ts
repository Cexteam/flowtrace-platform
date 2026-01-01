/**
 * CandleProcessingPort (Port In)
 *
 * Defines what the candle processing application can do.
 * Implemented by CandleProcessingService.
 *
 */

import { CandleGroup } from '../../../domain/entities/CandleGroup.js';

// Import DTOs from use cases (single source of truth)
import {
  ProcessTradeRequest,
  ProcessTradeResult,
} from '../../use-cases/ProcessTrade/DTO.js';

import { InitializeSymbolRequest } from '../../use-cases/InitializeSymbol/DTO.js';

// Re-export DTOs for convenience
export { ProcessTradeRequest, ProcessTradeResult };
export { InitializeSymbolRequest };

/**
 * CandleProcessingPort interface
 * Defines the inbound operations for candle processing
 */
export interface CandleProcessingPort {
  /**
   * Process a trade and update candles
   * @param request - Trade processing request
   * @returns Processing result with updated candles
   */
  processTrade(request: ProcessTradeRequest): Promise<ProcessTradeResult>;

  /**
   * Initialize a symbol for candle processing
   * @param request - Symbol initialization request
   */
  initializeSymbol(request: InitializeSymbolRequest): Promise<void>;

  /**
   * Get the current candle group for a symbol
   * @param symbol - Symbol to get candles for
   * @returns CandleGroup or null if not initialized
   */
  getCandleGroup(symbol: string): Promise<CandleGroup | null>;
}
