/**
 * ExchangeManagement Feature DI Types
 *
 * Defines dependency injection symbols for the exchangeManagement feature.
 *
 */

export const EXCHANGE_MANAGEMENT_TYPES = {
  // Ports
  ExchangeConfigPort: Symbol.for('ExchangeManagement.ExchangeConfigPort'),
  ExchangeHealthPort: Symbol.for('ExchangeManagement.ExchangeHealthPort'),
  ExchangeManagementPort: Symbol.for(
    'ExchangeManagement.ExchangeManagementPort'
  ),

  // Services
  ExchangeConfigService: Symbol.for('ExchangeManagement.ExchangeConfigService'),
  ExchangeHealthMonitor: Symbol.for('ExchangeManagement.ExchangeHealthMonitor'),
  ExchangeManagementService: Symbol.for(
    'ExchangeManagement.ExchangeManagementService'
  ),

  // Note: ExchangeConfigRepository replaced by ExchangeRepository
  ExchangeRepository: Symbol.for('ExchangeManagement.ExchangeRepository'),

  // Use Cases - Inbound Ports
  GetExchangePort: Symbol.for('ExchangeManagement.GetExchangePort'),
  UpdateExchangePort: Symbol.for('ExchangeManagement.UpdateExchangePort'),
  GetEnabledExchangesPort: Symbol.for(
    'ExchangeManagement.GetEnabledExchangesPort'
  ),
  TestExchangeConnectionPort: Symbol.for(
    'ExchangeManagement.TestExchangeConnectionPort'
  ),
  ManageExchangeCredentialsPort: Symbol.for(
    'ExchangeManagement.ManageExchangeCredentialsPort'
  ),

  // Use Cases - Implementations
  GetExchangeUseCase: Symbol.for('ExchangeManagement.GetExchangeUseCase'),
  GetAllExchangesUseCase: Symbol.for(
    'ExchangeManagement.GetAllExchangesUseCase'
  ),
  UpdateExchangeUseCase: Symbol.for('ExchangeManagement.UpdateExchangeUseCase'),
  GetEnabledExchangesUseCase: Symbol.for(
    'ExchangeManagement.GetEnabledExchangesUseCase'
  ),
  TestExchangeConnectionUseCase: Symbol.for(
    'ExchangeManagement.TestExchangeConnectionUseCase'
  ),
  ManageExchangeCredentialsUseCase: Symbol.for(
    'ExchangeManagement.ManageExchangeCredentialsUseCase'
  ),

  // API Clients - Outbound Ports
  ExchangeApiClient: Symbol.for('ExchangeManagement.ExchangeApiClient'),
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
