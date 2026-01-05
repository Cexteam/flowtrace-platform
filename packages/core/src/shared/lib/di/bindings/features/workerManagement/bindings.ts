/**
 * WorkerManagement Feature Core Bindings
 *
 * Configures runtime-agnostic bindings for the WorkerManagement feature.
 *
 * Services bound in this module:
 * - WorkerManagementService: Unified service for worker lifecycle, communication, and routing
 * - WorkerStatusService: Service for worker status and health monitoring
 * - SpawnWorkerUseCase: Spawn new worker thread
 * - CheckWorkerHealthUseCase: Check worker health
 * - GetSystemHealthUseCase: Get system health status
 * - RouteTradesUseCase: Route trades to workers
 * - AssignSymbolToWorkerUseCase: Assign symbol to worker
 * - RemoveSymbolFromWorkerUseCase: Remove symbol from worker
 * - ConsistentHashRouter: Domain service for consistent hashing
 * - NodeWorkerThreadAdapter: Worker thread adapter
 */

import { Container } from 'inversify';
import { WORKER_MANAGEMENT_TYPES } from './types.js';

// Application Layer - Ports
import { WorkerManagementPort } from '../../../../../../features/workerManagement/application/ports/in/WorkerManagementPort.js';
import { WorkerStatusPort } from '../../../../../../features/workerManagement/application/ports/in/WorkerStatusPort.js';
import { WorkerThreadPort } from '../../../../../../features/workerManagement/application/ports/out/WorkerThreadPort.js';

// Application Layer - Use Cases (existing)
import { SpawnWorkerUseCase } from '../../../../../../features/workerManagement/application/use-cases/SpawnWorker/index.js';
import { CheckWorkerHealthUseCase } from '../../../../../../features/workerManagement/application/use-cases/CheckWorkerHealth/index.js';
import { GetSystemHealthUseCase } from '../../../../../../features/workerManagement/application/use-cases/GetSystemHealth/index.js';

// Application Layer - Use Cases (moved from tradeRouter)
import { RouteTradesUseCase } from '../../../../../../features/workerManagement/application/use-cases/RouteTrades/index.js';
import { AssignSymbolToWorkerUseCase } from '../../../../../../features/workerManagement/application/use-cases/AssignSymbolToWorker/index.js';
import { RemoveSymbolFromWorkerUseCase } from '../../../../../../features/workerManagement/application/use-cases/RemoveSymbolFromWorker/index.js';

// Application Layer - Services
import { WorkerManagementService } from '../../../../../../features/workerManagement/application/services/WorkerManagementService.js';
import { WorkerStatusService } from '../../../../../../features/workerManagement/application/services/WorkerStatusService.js';

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
  // INFRASTRUCTURE LAYER - ADAPTERS
  // ========================================

  // NodeWorkerThreadAdapter implements WorkerThreadPort
  // Must be bound first as other services depend on it
  container
    .bind<WorkerThreadPort>(WORKER_MANAGEMENT_TYPES.WorkerThreadPort)
    .to(NodeWorkerThreadAdapter)
    .inSingletonScope();

  // ========================================
  // DOMAIN LAYER - SERVICES
  // ========================================

  container
    .bind(WORKER_MANAGEMENT_TYPES.ConsistentHashRouter)
    .to(ConsistentHashRouter)
    .inSingletonScope();

  // ========================================
  // APPLICATION LAYER - USE CASES (existing)
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
  // APPLICATION LAYER - USE CASES (moved from tradeRouter)
  // ========================================

  container
    .bind(WORKER_MANAGEMENT_TYPES.RouteTradesUseCase)
    .to(RouteTradesUseCase)
    .inSingletonScope();

  container
    .bind(WORKER_MANAGEMENT_TYPES.AssignSymbolToWorkerUseCase)
    .to(AssignSymbolToWorkerUseCase)
    .inSingletonScope();

  container
    .bind(WORKER_MANAGEMENT_TYPES.RemoveSymbolFromWorkerUseCase)
    .to(RemoveSymbolFromWorkerUseCase)
    .inSingletonScope();

  // ========================================
  // APPLICATION LAYER - SERVICES (INBOUND PORTS)
  // ========================================

  // WorkerManagementService implements WorkerManagementPort
  container
    .bind(WORKER_MANAGEMENT_TYPES.WorkerManagementService)
    .to(WorkerManagementService)
    .inSingletonScope();

  container
    .bind<WorkerManagementPort>(WORKER_MANAGEMENT_TYPES.WorkerManagementPort)
    .toService(WORKER_MANAGEMENT_TYPES.WorkerManagementService);

  // WorkerStatusService implements WorkerStatusPort
  container
    .bind(WORKER_MANAGEMENT_TYPES.WorkerStatusService)
    .to(WorkerStatusService)
    .inSingletonScope();

  container
    .bind<WorkerStatusPort>(WORKER_MANAGEMENT_TYPES.WorkerStatusPort)
    .toService(WORKER_MANAGEMENT_TYPES.WorkerStatusService);
}
