/**
 * SymbolManagement Feature DI Types
 *
 * Defines dependency injection symbols for the symbolManagement feature.
 * Following Hexagonal Architecture pattern with ports and adapters.
 *
 */

export const SYMBOL_MANAGEMENT_TYPES = {
  // Domain Repositories (Outbound Ports)
  ISymbolRepository: Symbol.for('SymbolManagement.ISymbolRepository'),

  // Application Ports (Inbound Ports)
  SymbolManagementPort: Symbol.for('SymbolManagement.SymbolManagementPort'),
  WorkerAssignmentServicePort: Symbol.for(
    'SymbolManagement.WorkerAssignmentServicePort'
  ),

  // Application Ports (Outbound Ports)
  // Note: Exchange-related ports moved to exchangeManagement feature

  // Use Cases
  SyncSymbolsFromExchangeUseCase: Symbol.for(
    'SymbolManagement.SyncSymbolsFromExchangeUseCase'
  ),
  ActivateSymbolUseCase: Symbol.for('SymbolManagement.ActivateSymbolUseCase'),
  DeactivateSymbolUseCase: Symbol.for(
    'SymbolManagement.DeactivateSymbolUseCase'
  ),

  // Worker Assignment Use Cases
  AssignSymbolToWorkerUseCase: Symbol.for(
    'SymbolManagement.AssignSymbolToWorkerUseCase'
  ),
  FindAssignmentsByWorkerUseCase: Symbol.for(
    'SymbolManagement.FindAssignmentsByWorkerUseCase'
  ),
  FindAssignmentsByExchangeUseCase: Symbol.for(
    'SymbolManagement.FindAssignmentsByExchangeUseCase'
  ),
  GetAssignmentUseCase: Symbol.for('SymbolManagement.GetAssignmentUseCase'),
  RemoveAssignmentUseCase: Symbol.for(
    'SymbolManagement.RemoveAssignmentUseCase'
  ),

  // Worker Assignment Repository
  WorkerAssignmentRepository: Symbol.for(
    'SymbolManagement.WorkerAssignmentRepository'
  ),

  // Cron Jobs
  SymbolSyncCronJob: Symbol.for('SymbolManagement.SymbolSyncCronJob'),

  // Legacy types (for backward compatibility)
  SymbolRepository: Symbol.for('SymbolManagement.SymbolRepository'),
  WorkerAssignmentService: Symbol.for(
    'SymbolManagement.WorkerAssignmentService'
  ),
} as const;

export type SymbolManagementTypes = typeof SYMBOL_MANAGEMENT_TYPES;
