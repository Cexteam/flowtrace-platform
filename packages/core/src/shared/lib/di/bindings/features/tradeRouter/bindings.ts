/**
 * TradeRouter Feature Core Bindings
 *
 * Configures runtime-agnostic bindings for the TradeRouter feature.
 * This includes application services, use cases, and infrastructure that
 * doesn't depend on platform-specific adapters.
 *
 * Platform-specific adapters (repositories) are configured separately
 * in the adapters/ directory.
 *
 * Services bound in this module:
 * - TradeRouterService: Main application service (inbound port)
 * - WorkerManagerService: Worker manager service (inbound port)
 * - RouteTradesUseCase: Route trades to workers
 * - AssignSymbolToWorkerUseCase: Assign symbol to worker
 * - RemoveSymbolFromWorkerUseCase: Remove symbol from worker
 * - GetRoutingStatusUseCase: Get routing status
 * - BalanceWorkersUseCase: Balance worker load
 * - RoutingService: Domain routing service
 * - WorkerInfrastructureDrivenAdapter: Worker infrastructure adapter
 * - WorkerRepository: Worker repository
 *
 */

import { Container } from 'inversify';
import { TRADE_ROUTER_TYPES } from './types.js';

// Domain Layer
import { RoutingService } from '../../../../../../features/tradeRouter/domain/services/RoutingService.js';

// Application Layer - Services
import { TradeRouterService } from '../../../../../../features/tradeRouter/application/services/TradeRouterService.js';
import { WorkerManagerService } from '../../../../../../features/tradeRouter/application/services/WorkerManagerService.js';

// Application Layer - Use Cases
import { RouteTradesUseCase } from '../../../../../../features/tradeRouter/application/use-cases/RouteTrades/index.js';
import { AssignSymbolToWorkerUseCase } from '../../../../../../features/tradeRouter/application/use-cases/AssignSymbolToWorker/index.js';
import { RemoveSymbolFromWorkerUseCase } from '../../../../../../features/tradeRouter/application/use-cases/RemoveSymbolFromWorker/index.js';
import { GetRoutingStatusUseCase } from '../../../../../../features/tradeRouter/application/use-cases/GetRoutingStatus/index.js';
import { BalanceWorkersUseCase } from '../../../../../../features/tradeRouter/application/use-cases/BalanceWorkers/index.js';

// Infrastructure Adapters
import { WorkerInfrastructureDrivenAdapter } from '../../../../../../features/tradeRouter/infrastructure/adapters/WorkerInfrastructureDrivenAdapter.js';

// Infrastructure Repositories
import { WorkerRepositoryImpl } from '../../../../../../features/tradeRouter/infrastructure/repositories/WorkerRepositoryImpl.js';

/**
 * Configure TradeRouter core bindings
 *
 * Binds all platform-agnostic services for the TradeRouter feature.
 * Platform-specific adapters are bound separately using the adapter
 * configuration functions.
 *
 * @param container - InversifyJS container
 */
export function configureTradeRouterCore(container: Container): void {
  // ========================================
  // DOMAIN LAYER
  // ========================================

  container
    .bind<RoutingService>(TRADE_ROUTER_TYPES.RoutingService)
    .to(RoutingService)
    .inSingletonScope();

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

  container
    .bind(TRADE_ROUTER_TYPES.GetRoutingStatusUseCase)
    .to(GetRoutingStatusUseCase)
    .inSingletonScope();

  container
    .bind(TRADE_ROUTER_TYPES.BalanceWorkersUseCase)
    .to(BalanceWorkersUseCase)
    .inSingletonScope();

  // ========================================
  // APPLICATION LAYER - SERVICES (INBOUND PORTS)
  // ========================================

  container
    .bind(TRADE_ROUTER_TYPES.TradeRouterDrivingPort)
    .to(TradeRouterService)
    .inSingletonScope();

  // Legacy binding for backward compatibility
  container
    .bind(TRADE_ROUTER_TYPES.TradeRouterService)
    .to(TradeRouterService)
    .inSingletonScope();

  container
    .bind(TRADE_ROUTER_TYPES.WorkerManagerDrivingPort)
    .to(WorkerManagerService)
    .inSingletonScope();

  // Legacy binding for backward compatibility
  container
    .bind(TRADE_ROUTER_TYPES.WorkerManagerService)
    .to(WorkerManagerService)
    .inSingletonScope();

  // ========================================
  // INFRASTRUCTURE LAYER
  // ========================================

  container
    .bind(TRADE_ROUTER_TYPES.WorkerInfrastructureDrivenPort)
    .to(WorkerInfrastructureDrivenAdapter)
    .inSingletonScope();

  // ========================================
  // REPOSITORIES
  // ========================================

  container
    .bind(TRADE_ROUTER_TYPES.WorkerRepository)
    .to(WorkerRepositoryImpl)
    .inSingletonScope();
}
