/**
 * Trade Router Feature - Public API
 * Entry point exporting interfaces and contracts for external consumers
 */

// Ports (public interfaces)
export type {
  TradeRouterDrivingPort
} from './application/ports/in/TradeRouterDrivingPort.js';

export type {
  WorkerManagerDrivingPort
} from './application/ports/in/WorkerManagerDrivingPort.js';

export type {
  WorkerInfrastructureDrivenPort
} from './application/ports/out/WorkerInfrastructureDrivenPort.js';

// Domain entities (for external use)
export { WorkerThread } from './domain/entities/WorkerThread.js';
export { HashRing } from './domain/value-objects/HashRing.js';

// Services (rarely exposed directly)
export { TradeRouterService } from './application/services/TradeRouterService.js';
export { WorkerManagerService } from './application/services/WorkerManagerService.js';
export { RoutingService } from './domain/services/RoutingService.js';
