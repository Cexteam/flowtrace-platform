/**
 * Symbol Management Feature - Main Export
 *
 * Barrel export for the entire Symbol Management feature
 */

// DI Module (re-export from shared)
export { configureSymbolManagement } from '../../shared/lib/di/bindings/features/symbolManagement/index.js';
export { SYMBOL_MANAGEMENT_TYPES } from '../../shared/lib/di/bindings/features/symbolManagement/types.js';

// Domain
export { Symbol, SymbolStatus, SymbolConfig } from './domain/entities/Symbol.js';
export type { SymbolRepository } from './domain/repositories/SymbolRepository.js';
export type {
  Exchange,
  ExchangeMetadata,
  BinanceMetadata,
  BybitMetadata,
  OKXMetadata,
} from './domain/types/ExchangeMetadata.js';

// Application - Ports (Inbound)
export type {
  SymbolManagementPort,
  SyncResult as SymbolSyncResult,
} from './application/ports/in/SymbolManagementPort.js';
export type { WorkerAssignmentServicePort } from './application/ports/in/WorkerAssignmentServicePort.js';

// Application - Ports (Outbound)
// Note: Exchange-related ports moved to exchangeManagement feature

// Application - Services
export {
  SymbolManagementService,
  WorkerAssignmentService,
  type WorkerAssignment,
} from './application/services/index.js';

// Application - Use Cases
export { SyncSymbolsFromExchangeUseCase } from './application/use-cases/SyncSymbolsFromExchange/index.js';
export type {
  SyncResult,
  SyncSymbolsInput,
} from './application/use-cases/SyncSymbolsFromExchange/index.js';
export { ActivateSymbolUseCase } from './application/use-cases/ActivateSymbol/ActivateSymbolUseCase.js';
export type {
  ActivateSymbolRequest,
  ActivateSymbolResponse,
} from './application/use-cases/ActivateSymbol/DTO.js';
export { DeactivateSymbolUseCase } from './application/use-cases/DeactivateSymbol/DeactivateSymbolUseCase.js';
export type {
  DeactivateSymbolRequest,
  DeactivateSymbolResponse,
} from './application/use-cases/DeactivateSymbol/DTO.js';

// Infrastructure
// Note: Exchange-related components have been moved to exchangeManagement feature
