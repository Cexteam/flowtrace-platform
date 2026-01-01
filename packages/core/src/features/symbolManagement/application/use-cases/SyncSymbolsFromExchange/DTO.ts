/**
 * DTOs for SyncSymbolsFromExchange Use Case
 */

import { Exchange } from '../../../domain/types/ExchangeMetadata.js';

export interface SyncSymbolsInput {
  exchange: Exchange;
}

export interface SyncResult {
  success: boolean;
  exchange: string;
  newSymbols: string[];
  delistedSymbols: string[];
  updatedSymbols: string[];
  errors: string[];
  timestamp: Date;
}
