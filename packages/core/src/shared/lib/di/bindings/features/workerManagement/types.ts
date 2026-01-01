/**
 * WorkerManagement Feature DI Types
 *
 * Defines dependency injection symbols for the workerManagement feature.
 *
 */

export const WORKER_MANAGEMENT_TYPES = {
  // Ports (Interfaces)
  WorkerPoolPort: Symbol.for('WorkerPoolPort'),
  WorkerCommunicationPort: Symbol.for('WorkerCommunicationPort'),
  WorkerThreadPort: Symbol.for('WorkerThreadPort'),
  WorkerHealthMonitorPort: Symbol.for('WorkerHealthMonitorPort'),

  // Use Cases
  SpawnWorkerUseCase: Symbol.for('SpawnWorkerUseCase'),
  SendTradeToWorkerUseCase: Symbol.for('SendTradeToWorkerUseCase'),
  CheckWorkerHealthUseCase: Symbol.for('CheckWorkerHealthUseCase'),
  GetSystemHealthUseCase: Symbol.for('GetSystemHealthUseCase'),

  // Services
  WorkerPoolService: Symbol.for('WorkerPoolService'),
  WorkerIPCService: Symbol.for('WorkerIPCService'),
  WorkerHealthMonitorService: Symbol.for('WorkerHealthMonitorService'),

  // Domain Services
  ConsistentHashRouter: Symbol.for('ConsistentHashRouter'),
} as const;
