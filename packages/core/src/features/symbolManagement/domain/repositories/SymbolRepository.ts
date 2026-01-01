/**
 * Symbol Repository Interface - Domain Layer
 * Defines contract for symbol persistence
 */

import { Symbol, SymbolStatus } from '../entities/Symbol.js';

export interface SymbolRepository {
  /**
   * Find symbol by symbol name
   */
  findBySymbol(symbol: string, exchange: string): Promise<Symbol | null>;

  /**
   * Find all symbols with filters
   */
  findAll(filters?: {
    exchange?: string;
    status?: SymbolStatus[] | SymbolStatus | string;
    isStreaming?: boolean;
    isProcessing?: boolean;
    enabledByAdmin?: boolean;
  }): Promise<Symbol[]>;

  /**
   * Find symbols that need review
   */
  findNeedingReview(): Promise<Symbol[]>;

  /**
   * Find active symbols (for startup)
   */
  findActiveSymbols(): Promise<Symbol[]>;

  /**
   * Find symbols not seen recently (potential delisted)
   */
  findStaleSymbols(olderThan: Date): Promise<Symbol[]>;

  /**
   * Save or update symbol
   */
  save(symbol: Symbol): Promise<Symbol>;

  /**
   * Save multiple symbols (bulk operation)
   */
  saveMany(symbols: Symbol[]): Promise<Symbol[]>;

  /**
   * Delete symbol
   */
  delete(symbolId: string): Promise<void>;

  /**
   * Check if symbol exists
   */
  exists(symbol: string, exchange: string): Promise<boolean>;
}
