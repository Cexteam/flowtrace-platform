/**
 * WorkerManagement Feature Core Bindings
 *
 * Configures runtime-agnostic bindings for the WorkerManagement feature.
 * This includes application services, use cases, and infrastructure that
 * doesn't depend on platform-specific adapters.
 *
 * Platform-specific adapters are configured separately in the adapters/ directory.
 *
 * Services bound in this module:
 * - WorkerPoolService: Worker pool management service (inbound port)
 * - WorkerIPCService: Worker IPC communication service (inbound port)
 * - WorkerHealthMonitorService: Worker health monitoring service (inbound port)
 * - SpawnWorkerUseCase: Spawn new worker thread
 * - CheckWorkerHealthUseCase: Check worker health
 * - GetSystemHealthUseCase: Get system health status
 * - ConsistentHashRouter: Domain service for consistent hashing
 * - NodeWorkerThreadAdapter: Worker thread adapter
 *
 */

import { Container } from 'inversify';
import { WORKER_MANAGEMENT_TYPES } from './types.js';

// Application Layer - Ports
import { WorkerPoolPort } from '../../../../../../features/workerManagement/application/ports/in/WorkerPoolPort.js';
import { WorkerCommunicationPort } from '../../../../../../features/workerManagement/application/ports/in/WorkerCommunicationPort.js';
import { WorkerHealthMonitorPort } from '../../../../../../features/workerManagement/application/ports/in/WorkerHealthMonitorPort.js';
import { WorkerThreadPort } from '../../../../../../features/workerManagement/application/ports/out/WorkerThreadPort.js';

// Application Layer - Use Cases
import { SpawnWorkerUseCase } from '../../../../../../features/workerManagement/application/use-cases/SpawnWorker/index.js';
import { CheckWorkerHealthUseCase } from '../../../../../../features/workerManagement/application/use-cases/CheckWorkerHealth/index.js';
import { GetSystemHealthUseCase } from '../../../../../../features/workerManagement/application/use-cases/GetSystemHealth/index.js';

// Application Layer - Services
import { WorkerPoolService } from '../../../../../../features/workerManagement/application/services/WorkerPoolService.js';
import { WorkerIPCService } from '../../../../../../features/workerManagement/application/services/WorkerIPCService.js';
import { WorkerHealthMonitorService } from '../../../../../../features/workerManagement/application/services/WorkerHealthMonitorService.js';

// Domain Layer - Services
import { ConsistentHashRouter } from '../../../../../../features/workerManagement/domain/services/ConsistentHashRouter.js';

// Infrastructure Layer - Adapters
import { NodeWorkerThreadAdapter } from '../../../../../../features/workerManagement/infrastructure/adapters/NodeWorkerThreadAdapter.js';

/**
 * Configure WorkerManagement core bindings
 *
 * Binds all platform-agnostic services for the WorkerManagement feature.
 * This feature is main-thread-only and should not be bound in worker containers.
 *
 * @param container - InversifyJS container
 */
export function configureWorkerManagementCore(container: Container): void {
  // ========================================
  // DOMAIN LAYER - SERVICES
  // ========================================

  container
    .bind(WORKER_MANAGEMENT_TYPES.ConsistentHashRouter)
    .to(ConsistentHashRouter)
    .inSingletonScope();

  // ========================================
  // APPLICATION LAYER - USE CASES
  // ========================================

  container
    .bind(WORKER_MANAGEMENT_TYPES.SpawnWorkerUseCase)
    .to(SpawnWorkerUseCase)
    .inSingletonScope();

  container
    .bind(WORKER_MANAGEMENT_TYPES.CheckWorkerHealthUseCase)
    .to(CheckWorkerHealthUseCase)
    .inSingletonScope();

  container
    .bind(WORKER_MANAGEMENT_TYPES.GetSystemHealthUseCase)
    .to(GetSystemHealthUseCase)
    .inSingletonScope();

  // ========================================
  // APPLICATION LAYER - SERVICES (INBOUND PORTS)
  // ========================================

  // WorkerPoolService implements WorkerPoolPort
  container
    .bind(WORKER_MANAGEMENT_TYPES.WorkerPoolService)
    .to(WorkerPoolService)
    .inSingletonScope();

  container
    .bind<WorkerPoolPort>(WORKER_MANAGEMENT_TYPES.WorkerPoolPort)
    .toService(WORKER_MANAGEMENT_TYPES.WorkerPoolService);

  // WorkerIPCService implements WorkerCommunicationPort
  container
    .bind(WORKER_MANAGEMENT_TYPES.WorkerIPCService)
    .to(WorkerIPCService)
    .inSingletonScope();

  container
    .bind<WorkerCommunicationPort>(
      WORKER_MANAGEMENT_TYPES.WorkerCommunicationPort
    )
    .toService(WORKER_MANAGEMENT_TYPES.WorkerIPCService);

  // WorkerHealthMonitorService implements WorkerHealthMonitorPort
  container
    .bind(WORKER_MANAGEMENT_TYPES.WorkerHealthMonitorService)
    .to(WorkerHealthMonitorService)
    .inSingletonScope();

  container
    .bind<WorkerHealthMonitorPort>(
      WORKER_MANAGEMENT_TYPES.WorkerHealthMonitorPort
    )
    .toService(WORKER_MANAGEMENT_TYPES.WorkerHealthMonitorService);

  // ========================================
  // INFRASTRUCTURE LAYER - ADAPTERS
  // ========================================

  // NodeWorkerThreadAdapter implements WorkerThreadPort
  container
    .bind<WorkerThreadPort>(WORKER_MANAGEMENT_TYPES.WorkerThreadPort)
    .to(NodeWorkerThreadAdapter)
    .inSingletonScope();
}
