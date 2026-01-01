/**
 * Exchange Management Feature - Main Export
 *
 * Barrel export for the entire Exchange Management feature
 */

// DI Module (re-export from shared)
export { configureExchangeManagement } from '../../shared/lib/di/bindings/features/exchangeManagement/index.js';
export { EXCHANGE_MANAGEMENT_TYPES } from '../../shared/lib/di/bindings/features/exchangeManagement/types.js';

// Domain - Entities
export {
  Exchange,
  type ExchangeProps,
  type ExchangeHealth,
} from './domain/entities/Exchange.js';

// Domain - Value Objects
export {
  ExchangeStatus,
  type ImplementationStatus,
} from './domain/value-objects/ExchangeStatus.js';

// Domain - Repositories
export type {
  ExchangeRepository,
  ExchangeFilter,
} from './domain/repositories/ExchangeRepository.js';

// Application - Ports (Inbound)
export type {
  ExchangeManagementPort,
  ExchangeFilter as ExchangeManagementFilter,
} from './application/ports/in/ExchangeManagementPort.js';

// Application - Services
export { ExchangeManagementService } from './application/services/index.js';

// Infrastructure - Adapters
export {
  DrizzleExchangeRepository,
  BinanceExchangeApiAdapter,
  BybitExchangeApiAdapter,
  OKXExchangeApiAdapter,
  ExchangeApiClientFactory,
} from './infrastructure/index.js';

// Application - Ports (Outbound)
export type {
  ExchangeApiClient,
  ExchangeSymbol,
} from './application/ports/out/index.js';

export { ExchangeApiError } from './application/ports/out/index.js';
