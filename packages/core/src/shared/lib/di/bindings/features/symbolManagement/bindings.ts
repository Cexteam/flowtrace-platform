/**
 * SymbolManagement Feature Core Bindings
 *
 * Configures runtime-agnostic bindings for the SymbolManagement feature.
 * This includes application services, use cases, and infrastructure that
 * doesn't depend on platform-specific adapters.
 *
 * Platform-specific adapters (repositories) are configured separately
 * in the adapters/ directory.
 *
 * Services bound in this module:
 * - SymbolManagementService: Main application service (inbound port)
 * - WorkerAssignmentService: Worker assignment service (inbound port)
 * - SyncSymbolsFromExchangeUseCase: Sync symbols from exchange
 * - ActivateSymbolUseCase: Activate a symbol
 * - DeactivateSymbolUseCase: Deactivate a symbol
 * - AssignSymbolToWorkerUseCase: Assign symbol to worker
 * - FindAssignmentsByWorkerUseCase: Find assignments by worker
 * - FindAssignmentsByExchangeUseCase: Find assignments by exchange
 * - GetAssignmentUseCase: Get assignment by ID
 * - RemoveAssignmentUseCase: Remove assignment
 * - WorkerAssignmentRepository: Worker assignment repository
 * Note: Exchange-related components moved to exchangeManagement feature

 *
 */

import { Container } from 'inversify';
import { SYMBOL_MANAGEMENT_TYPES } from './types.js';

// Domain Interfaces (Outbound Ports)
import { SymbolRepository } from '../../../../../../features/symbolManagement/domain/repositories/SymbolRepository.js';
import { WorkerAssignmentRepository } from '../../../../../../features/symbolManagement/domain/repositories/WorkerAssignmentRepository.js';
// Note: ExchangeConfigRepository moved to exchangeManagement feature

// Application Ports (Inbound Ports)
import { SymbolManagementPort } from '../../../../../../features/symbolManagement/application/ports/in/SymbolManagementPort.js';
import { WorkerAssignmentServicePort } from '../../../../../../features/symbolManagement/application/ports/in/WorkerAssignmentServicePort.js';

// Infrastructure Adapters
import { DrizzleSymbolRepository } from '../../../../../../features/symbolManagement/infrastructure/adapters/DrizzleSymbolRepository.js';
import { InMemoryWorkerAssignmentRepository } from '../../../../../../features/symbolManagement/infrastructure/adapters/memory/InMemoryWorkerAssignmentRepository.js';
// Note: Exchange-related adapters moved to exchangeManagement feature

// Application Services
import { SymbolManagementService } from '../../../../../../features/symbolManagement/application/services/SymbolManagementService.js';
import { WorkerAssignmentService } from '../../../../../../features/symbolManagement/application/services/WorkerAssignmentService.js';

// Use Cases
import { SyncSymbolsFromExchangeUseCase } from '../../../../../../features/symbolManagement/application/use-cases/SyncSymbolsFromExchange/SyncSymbolsFromExchangeUseCase.js';
import { ActivateSymbolUseCase } from '../../../../../../features/symbolManagement/application/use-cases/ActivateSymbol/ActivateSymbolUseCase.js';
import { DeactivateSymbolUseCase } from '../../../../../../features/symbolManagement/application/use-cases/DeactivateSymbol/DeactivateSymbolUseCase.js';
import { AssignSymbolToWorkerUseCase } from '../../../../../../features/symbolManagement/application/use-cases/AssignSymbolToWorker/index.js';
import { FindAssignmentsByWorkerUseCase } from '../../../../../../features/symbolManagement/application/use-cases/FindAssignmentsByWorker/index.js';
import { FindAssignmentsByExchangeUseCase } from '../../../../../../features/symbolManagement/application/use-cases/FindAssignmentsByExchange/index.js';
import { GetAssignmentUseCase } from '../../../../../../features/symbolManagement/application/use-cases/GetAssignment/index.js';
import { RemoveAssignmentUseCase } from '../../../../../../features/symbolManagement/application/use-cases/RemoveAssignment/index.js';

/**
 * Configure SymbolManagement core bindings
 *
 * Binds all platform-agnostic services for the SymbolManagement feature.
 * Platform-specific adapters (SymbolRepository) must be bound separately
 * using the adapter configuration functions.
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

  container
    .bind<WorkerAssignmentServicePort>(
      SYMBOL_MANAGEMENT_TYPES.WorkerAssignmentServicePort
    )
    .to(WorkerAssignmentService)
    .inSingletonScope();

  // Legacy binding for backward compatibility
  container
    .bind<WorkerAssignmentService>(
      SYMBOL_MANAGEMENT_TYPES.WorkerAssignmentService
    )
    .to(WorkerAssignmentService)
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

  // Worker Assignment Use Cases
  container
    .bind<AssignSymbolToWorkerUseCase>(
      SYMBOL_MANAGEMENT_TYPES.AssignSymbolToWorkerUseCase
    )
    .to(AssignSymbolToWorkerUseCase);

  container
    .bind<FindAssignmentsByWorkerUseCase>(
      SYMBOL_MANAGEMENT_TYPES.FindAssignmentsByWorkerUseCase
    )
    .to(FindAssignmentsByWorkerUseCase);

  container
    .bind<FindAssignmentsByExchangeUseCase>(
      SYMBOL_MANAGEMENT_TYPES.FindAssignmentsByExchangeUseCase
    )
    .to(FindAssignmentsByExchangeUseCase);

  container
    .bind<GetAssignmentUseCase>(SYMBOL_MANAGEMENT_TYPES.GetAssignmentUseCase)
    .to(GetAssignmentUseCase);

  container
    .bind<RemoveAssignmentUseCase>(
      SYMBOL_MANAGEMENT_TYPES.RemoveAssignmentUseCase
    )
    .to(RemoveAssignmentUseCase);

  // ========================================
  // OUTBOUND PORTS → ADAPTERS (Unified)
  // ========================================

  // Unified Symbol Repository (uses SQLite)
  container
    .bind<SymbolRepository>(SYMBOL_MANAGEMENT_TYPES.ISymbolRepository)
    .to(DrizzleSymbolRepository)
    .inSingletonScope();

  // Legacy binding for backward compatibility
  container
    .bind<SymbolRepository>(SYMBOL_MANAGEMENT_TYPES.SymbolRepository)
    .to(DrizzleSymbolRepository)
    .inSingletonScope();

  container
    .bind<WorkerAssignmentRepository>(
      SYMBOL_MANAGEMENT_TYPES.WorkerAssignmentRepository
    )
    .to(InMemoryWorkerAssignmentRepository)
    .inSingletonScope();

  // Note: Exchange-related bindings moved to exchangeManagement feature
}
