/**
 * InitializeSymbol DTOs
 *
 * Request types for InitializeSymbolUseCase
 */

import { SymbolConfig } from '../../../domain/types/index.js';

/**
 * Request to initialize a symbol
 */
export interface InitializeSymbolRequest {
  /** Symbol configuration */
  config: SymbolConfig;
}
