/**
 * WorkerManagement Feature DI Types
 *
 * Defines dependency injection symbols for the workerManagement feature.
 */

export const WORKER_MANAGEMENT_TYPES = {
  // ========================================
  // PORTS (Interfaces)
  // ========================================

  // New unified ports
  WorkerManagementPort: Symbol.for('WorkerManagementPort'),
  WorkerStatusPort: Symbol.for('WorkerStatusPort'),

  // Infrastructure port
  WorkerThreadPort: Symbol.for('WorkerThreadPort'),

  // ========================================
  // USE CASES
  // ========================================

  // Existing use cases
  SpawnWorkerUseCase: Symbol.for('SpawnWorkerUseCase'),
  CheckWorkerHealthUseCase: Symbol.for('CheckWorkerHealthUseCase'),
  GetSystemHealthUseCase: Symbol.for('GetSystemHealthUseCase'),

  // Use cases moved from tradeRouter
  RouteTradesUseCase: Symbol.for('RouteTradesUseCase'),
  AssignSymbolToWorkerUseCase: Symbol.for('AssignSymbolToWorkerUseCase'),
  RemoveSymbolFromWorkerUseCase: Symbol.for('RemoveSymbolFromWorkerUseCase'),

  // ========================================
  // SERVICES
  // ========================================

  // New unified services
  WorkerManagementService: Symbol.for('WorkerManagementService'),
  WorkerStatusService: Symbol.for('WorkerStatusService'),

  // ========================================
  // DOMAIN SERVICES
  // ========================================

  ConsistentHashRouter: Symbol.for('ConsistentHashRouter'),
} as const;
