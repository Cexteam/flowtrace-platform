/**
 * TradeRouter Feature Core Bindings
 *
 * Configures runtime-agnostic bindings for the TradeRouter feature.
 * This includes application services and use cases.
 *
 * Use cases now inject workerManagement ports directly:
 * - WorkerPoolPort
 * - WorkerCommunicationPort
 * - ConsistentHashRouter
 *
 * Services bound in this module:
 * - TradeRouterService: Main application service (inbound port)
 * - RouteTradesUseCase: Route trades to workers
 * - AssignSymbolToWorkerUseCase: Assign symbol to worker
 * - RemoveSymbolFromWorkerUseCase: Remove symbol from worker
 */

import { Container } from 'inversify';
import { TRADE_ROUTER_TYPES } from './types.js';

// Application Layer - Services
import { TradeRouterService } from '../../../../../../features/tradeRouter/application/services/TradeRouterService.js';

// Application Layer - Use Cases
import { RouteTradesUseCase } from '../../../../../../features/tradeRouter/application/use-cases/RouteTrades/index.js';
import { AssignSymbolToWorkerUseCase } from '../../../../../../features/tradeRouter/application/use-cases/AssignSymbolToWorker/index.js';
import { RemoveSymbolFromWorkerUseCase } from '../../../../../../features/tradeRouter/application/use-cases/RemoveSymbolFromWorker/index.js';

/**
 * Configure TradeRouter core bindings
 *
 * Binds all platform-agnostic services for the TradeRouter feature.
 *
 * @param container - InversifyJS container
 */
export function configureTradeRouterCore(container: Container): void {
  // ========================================
  // APPLICATION LAYER - USE CASES
  // ========================================

  container
    .bind(TRADE_ROUTER_TYPES.RouteTradesUseCase)
    .to(RouteTradesUseCase)
    .inSingletonScope();

  container
    .bind(TRADE_ROUTER_TYPES.AssignSymbolToWorkerUseCase)
    .to(AssignSymbolToWorkerUseCase)
    .inSingletonScope();

  container
    .bind(TRADE_ROUTER_TYPES.RemoveSymbolFromWorkerUseCase)
    .to(RemoveSymbolFromWorkerUseCase)
    .inSingletonScope();

  // ========================================
  // APPLICATION LAYER - SERVICES (INBOUND PORTS)
  // ========================================

  container
    .bind(TRADE_ROUTER_TYPES.TradeRouterDrivingPort)
    .to(TradeRouterService)
    .inSingletonScope();
}
