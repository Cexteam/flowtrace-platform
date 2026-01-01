/**
 * Exchange Management UI DI Types
 *
 * Defines dependency injection symbols for the exchangeManagement UI feature.
 * Following Hexagonal Architecture pattern with ports and adapters.
 *
 */

// Re-export domain types for convenience
export type {
  Exchange,
  ExchangeImplementationStatus,
  ExchangeHealthStatus,
  ExchangeHealthCheck,
  ExchangeFeatures,
  ExchangeSyncHistoryEntry,
  ExchangeToggleResult,
} from '../../../../../features/exchangeManagement/domain';

// Re-export port types
export type {
  ExchangeApiPort,
  GetExchangesRequest,
  GetExchangesResponse,
} from '../../../../../features/exchangeManagement/application/ports/out/ExchangeApiPort';

export const EXCHANGE_UI_TYPES = {
  // Port Out - API adapters
  ExchangeApiPort: Symbol.for('ExchangeUI.ExchangeApiPort'),

  // Port In - Operations
  ExchangeOperationsPort: Symbol.for('ExchangeUI.ExchangeOperationsPort'),

  // Adapters
  HttpExchangeAdapter: Symbol.for('ExchangeUI.HttpExchangeAdapter'),
  IpcExchangeAdapter: Symbol.for('ExchangeUI.IpcExchangeAdapter'),
} as const;

export type ExchangeUITypes = typeof EXCHANGE_UI_TYPES;
