/**
 * Trade Router Feature - Public API
 * Entry point exporting interfaces and contracts for external consumers
 */

// Ports (public interfaces)
export type {
  TradeRouterDrivingPort,
  InitializeSymbolRoutingResult,
  WorkerPoolConfig,
  WorkerPoolStatus,
} from './application/ports/in/TradeRouterDrivingPort.js';

// Services (rarely exposed directly)
export { TradeRouterService } from './application/services/TradeRouterService.js';
