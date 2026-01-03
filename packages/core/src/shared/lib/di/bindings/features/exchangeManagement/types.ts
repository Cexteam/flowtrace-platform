/**
 * ExchangeManagement Feature DI Types
 *
 * Defines dependency injection symbols for the exchangeManagement feature.
 *
 */

export const EXCHANGE_MANAGEMENT_TYPES = {
  // Ports
  ExchangeManagementPort: Symbol.for(
    'ExchangeManagement.ExchangeManagementPort'
  ),

  // Services
  ExchangeManagementService: Symbol.for(
    'ExchangeManagement.ExchangeManagementService'
  ),

  // Repository
  ExchangeRepository: Symbol.for('ExchangeManagement.ExchangeRepository'),

  // Use Cases
  GetExchangeUseCase: Symbol.for('ExchangeManagement.GetExchangeUseCase'),
  GetAllExchangesUseCase: Symbol.for(
    'ExchangeManagement.GetAllExchangesUseCase'
  ),
  UpdateExchangeUseCase: Symbol.for('ExchangeManagement.UpdateExchangeUseCase'),
  TestExchangeConnectionUseCase: Symbol.for(
    'ExchangeManagement.TestExchangeConnectionUseCase'
  ),

  // API Client Factory
  ExchangeApiClientFactory: Symbol.for(
    'ExchangeManagement.ExchangeApiClientFactory'
  ),

  // API Adapters
  BinanceExchangeApiAdapter: Symbol.for(
    'ExchangeManagement.BinanceExchangeApiAdapter'
  ),
  BybitExchangeApiAdapter: Symbol.for(
    'ExchangeManagement.BybitExchangeApiAdapter'
  ),
  OKXExchangeApiAdapter: Symbol.for('ExchangeManagement.OKXExchangeApiAdapter'),
} as const;

// Export as SYMBOLS for backward compatibility
export const EXCHANGE_MANAGEMENT_SYMBOLS = EXCHANGE_MANAGEMENT_TYPES;
