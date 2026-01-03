/**
 * SymbolManagement Feature Core Bindings
 *
 * Configures runtime-agnostic bindings for the SymbolManagement feature.
 * This includes application services, use cases, and infrastructure that
 * doesn't depend on platform-specific adapters.
 *
 * Services bound in this module:
 * - SymbolManagementService: Main application service (inbound port)
 * - SyncSymbolsFromExchangeUseCase: Sync symbols from exchange
 * - ActivateSymbolUseCase: Activate a symbol
 * - DeactivateSymbolUseCase: Deactivate a symbol
 * Note: Exchange-related components moved to exchangeManagement feature
 *
 */

import { Container } from 'inversify';
import { SYMBOL_MANAGEMENT_TYPES } from './types.js';

// Domain Interfaces (Outbound Ports)
import { SymbolRepository } from '../../../../../../features/symbolManagement/domain/repositories/SymbolRepository.js';
// Note: ExchangeConfigRepository moved to exchangeManagement feature

// Application Ports (Inbound Ports)
import { SymbolManagementPort } from '../../../../../../features/symbolManagement/application/ports/in/SymbolManagementPort.js';

// Infrastructure Adapters
import { DrizzleSymbolRepository } from '../../../../../../features/symbolManagement/infrastructure/adapters/DrizzleSymbolRepository.js';
// Note: Exchange-related adapters moved to exchangeManagement feature

// Application Services
import { SymbolManagementService } from '../../../../../../features/symbolManagement/application/services/SymbolManagementService.js';

// Use Cases
import { SyncSymbolsFromExchangeUseCase } from '../../../../../../features/symbolManagement/application/use-cases/SyncSymbolsFromExchange/SyncSymbolsFromExchangeUseCase.js';
import { ActivateSymbolUseCase } from '../../../../../../features/symbolManagement/application/use-cases/ActivateSymbol/ActivateSymbolUseCase.js';
import { DeactivateSymbolUseCase } from '../../../../../../features/symbolManagement/application/use-cases/DeactivateSymbol/DeactivateSymbolUseCase.js';

/**
 * Configure SymbolManagement core bindings
 *
 * Binds all platform-agnostic services for the SymbolManagement feature.
 *
 * @param container - InversifyJS container
 */
export function configureSymbolManagementCore(container: Container): void {
  // ========================================
  // INBOUND PORTS → SERVICES
  // ========================================

  container
    .bind<SymbolManagementPort>(SYMBOL_MANAGEMENT_TYPES.SymbolManagementPort)
    .to(SymbolManagementService)
    .inSingletonScope();

  // ========================================
  // USE CASES
  // ========================================

  container
    .bind<SyncSymbolsFromExchangeUseCase>(
      SYMBOL_MANAGEMENT_TYPES.SyncSymbolsFromExchangeUseCase
    )
    .to(SyncSymbolsFromExchangeUseCase);

  container
    .bind<ActivateSymbolUseCase>(SYMBOL_MANAGEMENT_TYPES.ActivateSymbolUseCase)
    .to(ActivateSymbolUseCase);

  container
    .bind<DeactivateSymbolUseCase>(
      SYMBOL_MANAGEMENT_TYPES.DeactivateSymbolUseCase
    )
    .to(DeactivateSymbolUseCase);

  // ========================================
  // OUTBOUND PORTS → ADAPTERS (Unified)
  // ========================================

  // Unified Symbol Repository (uses SQLite)
  container
    .bind<SymbolRepository>(SYMBOL_MANAGEMENT_TYPES.SymbolRepository)
    .to(DrizzleSymbolRepository)
    .inSingletonScope();

  // Note: Exchange-related bindings moved to exchangeManagement feature
}
