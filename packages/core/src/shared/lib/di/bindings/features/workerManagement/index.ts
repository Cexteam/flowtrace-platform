/**
 * WorkerManagement Feature DI Module
 *
 * Public API for WorkerManagement dependency injection configuration.
 * This is a main-thread-only feature that manages worker thread lifecycle.
 *
 * ## Main Thread Only
 * WorkerManagement runs exclusively on the main thread and is responsible for:
 * - Spawning and managing worker thread pool
 * - Monitoring worker health and performance
 * - Routing trades to workers via IPC
 * - Handling worker failures and recovery
 * - Consistent hashing for symbol-to-worker assignment
 *
 * Use `configureWorkerManagement()` to configure all bindings.
 *
 * ## Services Available
 *
 * ### Application Services (Inbound Ports)
 * - WorkerPoolService: Worker pool lifecycle management
 * - WorkerIPCService: Inter-process communication with workers
 * - WorkerHealthMonitorService: Worker health monitoring
 *
 * ### Use Cases
 * - SpawnWorkerUseCase: Spawn new worker thread
 * - SendTradeToWorkerUseCase: Send trade data to worker
 * - CheckWorkerHealthUseCase: Check individual worker health
 * - GetSystemHealthUseCase: Get overall system health status
 *
 * ### Domain Services
 * - ConsistentHashRouter: Consistent hashing for load distribution
 *
 * ### Infrastructure
 * - NodeWorkerThreadAdapter: Node.js worker thread adapter
 *
 * @example
 * ```typescript
 * import { configureWorkerManagement } from './bindings/features/workerManagement/index.js';
 *
 * const container = new Container();
 * configureWorkerManagement(container);
 * ```
 *
 */

import { Container } from 'inversify';
import { configureWorkerManagementCore } from './bindings.js';

/**
 * Configure WorkerManagement bindings
 *
 * This function configures all bindings for the WorkerManagement feature,
 * including core services and use cases.
 *
 * This feature is main-thread-only and should not be configured in worker containers.
 *
 * @param container - InversifyJS container
 */
export function configureWorkerManagement(container: Container): void {
  configureWorkerManagementCore(container);
}

// Export types
export { WORKER_MANAGEMENT_TYPES } from './types.js';

// Export individual configuration functions for advanced use cases
export { configureWorkerManagementCore } from './bindings.js';
