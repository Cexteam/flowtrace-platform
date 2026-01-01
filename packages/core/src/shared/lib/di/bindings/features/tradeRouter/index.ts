/**
 * TradeRouter Feature DI Module
 *
 * Public API for TradeRouter dependency injection configuration.
 * This is a main-thread-only feature that manages trade routing to workers.
 *
 * ## Main Thread Only
 * TradeRouter runs exclusively on the main thread and is responsible for:
 * - Routing incoming trades to appropriate worker threads
 * - Managing symbol-to-worker assignments
 * - Balancing load across workers using consistent hashing
 * - Monitoring routing status and worker health
 *
 * Use `configureTradeRouter()` to configure all bindings.
 *
 * ## Services Available
 *
 * ### Application Services (Inbound Ports)
 * - TradeRouterService: Main application service for trade routing
 * - WorkerManagerService: Service for managing worker assignments
 *
 * ### Use Cases
 * - RouteTradesUseCase: Route trades to appropriate workers
 * - AssignSymbolToWorkerUseCase: Assign symbol to worker thread
 * - RemoveSymbolFromWorkerUseCase: Remove symbol from worker
 * - GetRoutingStatusUseCase: Get current routing status
 * - BalanceWorkersUseCase: Balance load across workers
 *
 * ### Domain Services
 * - RoutingService: Core routing logic with consistent hashing
 *
 * ### Infrastructure
 * - WorkerRepository: Worker state persistence
 * - WorkerInfrastructureDrivenAdapter: Worker infrastructure adapter
 *
 * @example
 * ```typescript
 * import { configureTradeRouter } from './bindings/features/tradeRouter/index.js';
 *
 * const container = new Container();
 * configureTradeRouter(container);
 * ```
 *
 */

import { Container } from 'inversify';
import { configureTradeRouterCore } from './bindings.js';

/**
 * Configure TradeRouter bindings
 *
 * This function configures all bindings for the TradeRouter feature,
 * including core services and use cases.
 *
 * @param container - InversifyJS container
 */
export function configureTradeRouter(container: Container): void {
  configureTradeRouterCore(container);
}

// Export types
export { TRADE_ROUTER_TYPES } from './types.js';

// Export individual configuration functions for advanced use cases
export { configureTradeRouterCore } from './bindings.js';
