/**
 * Symbol Management UI DI Types
 *
 * Defines dependency injection symbols for the symbolManagement UI feature.
 * Following Hexagonal Architecture pattern with ports and adapters.
 *
 */

// Re-export domain types for convenience
export type {
  Symbol,
  SymbolStatus,
  SymbolConfig,
  ExchangeMetadata,
  SymbolToggleResult,
  SymbolSyncResult,
} from '../../../../../features/symbolManagement/domain';

// Re-export port types
export type {
  SymbolApiPort,
  GetSymbolsRequest,
  GetSymbolsResponse,
} from '../../../../../features/symbolManagement/application/ports/out/SymbolApiPort';

export const SYMBOL_UI_TYPES = {
  // Port Out - API adapters
  SymbolApiPort: Symbol.for('SymbolUI.SymbolApiPort'),

  // Port In - Operations
  SymbolOperationsPort: Symbol.for('SymbolUI.SymbolOperationsPort'),

  // Adapters
  HttpSymbolAdapter: Symbol.for('SymbolUI.HttpSymbolAdapter'),
  IpcSymbolAdapter: Symbol.for('SymbolUI.IpcSymbolAdapter'),
} as const;

export type SymbolUITypes = typeof SYMBOL_UI_TYPES;
