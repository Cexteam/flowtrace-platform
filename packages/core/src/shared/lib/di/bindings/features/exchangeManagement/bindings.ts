/**
 * ExchangeManagement Feature Bindings
 *
 * Configures all bindings for the ExchangeManagement feature using unified repository pattern.
 * This includes application services, use cases, API clients, and unified repository adapters.
 *
 * Services bound in this module:
 * - ExchangeManagementService: Main application service (inbound port)
 * - Use Cases: All exchange management use cases
 * - API Clients: Exchange API client factory and adapters
 * - Repository: Unified DrizzleExchangeRepository with runtime schema selection
 *
 */

import { Container } from 'inversify';
import { EXCHANGE_MANAGEMENT_TYPES } from './types.js';

// Application Ports (Inbound Ports)
import { ExchangeManagementPort } from '../../../../../../features/exchangeManagement/application/ports/in/ExchangeManagementPort.js';

// Application Services
import { ExchangeManagementService } from '../../../../../../features/exchangeManagement/application/services/ExchangeManagementService.js';

// Use Cases
import { GetExchangeUseCase } from '../../../../../../features/exchangeManagement/application/use-cases/GetExchange/GetExchangeUseCase.js';
import { GetAllExchangesUseCase } from '../../../../../../features/exchangeManagement/application/use-cases/GetAllExchanges/GetAllExchangesUseCase.js';
import { UpdateExchangeUseCase } from '../../../../../../features/exchangeManagement/application/use-cases/UpdateExchange/UpdateExchangeUseCase.js';
import { GetEnabledExchangesUseCase } from '../../../../../../features/exchangeManagement/application/use-cases/GetEnabledExchanges/GetEnabledExchangesUseCase.js';
import { TestExchangeConnectionUseCase } from '../../../../../../features/exchangeManagement/application/use-cases/TestExchangeConnection/TestExchangeConnectionUseCase.js';
import { ManageExchangeCredentialsUseCase } from '../../../../../../features/exchangeManagement/application/use-cases/ManageExchangeCredentials/ManageExchangeCredentialsUseCase.js';

// Note: Use cases implement their own port interfaces directly

// API Clients
import { ExchangeApiClientFactory } from '../../../../../../features/exchangeManagement/infrastructure/adapters/api/ExchangeApiClientFactory.js';
import { BinanceExchangeApiAdapter } from '../../../../../../features/exchangeManagement/infrastructure/adapters/api/BinanceExchangeApiAdapter.js';
import { BybitExchangeApiAdapter } from '../../../../../../features/exchangeManagement/infrastructure/adapters/api/BybitExchangeApiAdapter.js';
import { OKXExchangeApiAdapter } from '../../../../../../features/exchangeManagement/infrastructure/adapters/api/OKXExchangeApiAdapter.js';

// Outbound Ports
import { ExchangeApiClient } from '../../../../../../features/exchangeManagement/application/ports/out/ExchangeApiClient.js';

// Domain Interfaces (Outbound Ports)
import { ExchangeRepository } from '../../../../../../features/exchangeManagement/domain/repositories/ExchangeRepository.js';

// Infrastructure Adapters - Unified Drizzle Repository
import { DrizzleExchangeRepository } from '../../../../../../features/exchangeManagement/infrastructure/adapters/repositories/DrizzleExchangeRepository.js';

/**
 * Configure ExchangeManagement bindings
 *
 * Binds all services for the ExchangeManagement feature including unified repository
 * with runtime schema selection that works for both Cloud and Desktop platforms.
 *
 * @param container - InversifyJS container
 */
export function configureExchangeManagement(container: Container): void {
  // ========================================
  // INBOUND PORTS → SERVICES
  // ========================================

  container
    .bind<ExchangeManagementPort>(
      EXCHANGE_MANAGEMENT_TYPES.ExchangeManagementPort
    )
    .to(ExchangeManagementService)
    .inSingletonScope();

  // Legacy binding for backward compatibility
  container
    .bind<ExchangeManagementService>(
      EXCHANGE_MANAGEMENT_TYPES.ExchangeManagementService
    )
    .to(ExchangeManagementService)
    .inSingletonScope();

  // ========================================
  // USE CASE PORTS → USE CASE IMPLEMENTATIONS
  // Note: Use cases implement their own port interfaces
  // ========================================

  // ========================================
  // USE CASE IMPLEMENTATIONS (for direct injection)
  // ========================================

  container
    .bind<GetExchangeUseCase>(EXCHANGE_MANAGEMENT_TYPES.GetExchangeUseCase)
    .to(GetExchangeUseCase)
    .inSingletonScope();

  container
    .bind<GetAllExchangesUseCase>(
      EXCHANGE_MANAGEMENT_TYPES.GetAllExchangesUseCase
    )
    .to(GetAllExchangesUseCase)
    .inSingletonScope();

  container
    .bind<UpdateExchangeUseCase>(
      EXCHANGE_MANAGEMENT_TYPES.UpdateExchangeUseCase
    )
    .to(UpdateExchangeUseCase)
    .inSingletonScope();

  container
    .bind<GetEnabledExchangesUseCase>(
      EXCHANGE_MANAGEMENT_TYPES.GetEnabledExchangesUseCase
    )
    .to(GetEnabledExchangesUseCase)
    .inSingletonScope();

  container
    .bind<TestExchangeConnectionUseCase>(
      EXCHANGE_MANAGEMENT_TYPES.TestExchangeConnectionUseCase
    )
    .to(TestExchangeConnectionUseCase)
    .inSingletonScope();

  container
    .bind<ManageExchangeCredentialsUseCase>(
      EXCHANGE_MANAGEMENT_TYPES.ManageExchangeCredentialsUseCase
    )
    .to(ManageExchangeCredentialsUseCase)
    .inSingletonScope();

  // ========================================
  // API CLIENTS
  // ========================================

  container
    .bind<ExchangeApiClientFactory>(
      EXCHANGE_MANAGEMENT_TYPES.ExchangeApiClientFactory
    )
    .to(ExchangeApiClientFactory)
    .inSingletonScope();

  container
    .bind<ExchangeApiClient>(
      EXCHANGE_MANAGEMENT_TYPES.BinanceExchangeApiAdapter
    )
    .to(BinanceExchangeApiAdapter)
    .inTransientScope();

  container
    .bind<ExchangeApiClient>(EXCHANGE_MANAGEMENT_TYPES.BybitExchangeApiAdapter)
    .to(BybitExchangeApiAdapter)
    .inTransientScope();

  container
    .bind<ExchangeApiClient>(EXCHANGE_MANAGEMENT_TYPES.OKXExchangeApiAdapter)
    .to(OKXExchangeApiAdapter)
    .inTransientScope();

  // ========================================
  // REPOSITORIES - UNIFIED ADAPTERS
  // ========================================

  container
    .bind<ExchangeRepository>(EXCHANGE_MANAGEMENT_TYPES.ExchangeRepository)
    .to(DrizzleExchangeRepository)
    .inSingletonScope();
}
