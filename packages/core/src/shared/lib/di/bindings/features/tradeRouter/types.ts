/**
 * TradeRouter Feature DI Types
 *
 * Defines dependency injection symbols for the tradeRouter feature.
 *
 */

export const TRADE_ROUTER_TYPES = {
  // Ports In (Driving Interfaces)
  TradeRouterDrivingPort: Symbol.for('TradeRouterDrivingPort'),
  WorkerManagerDrivingPort: Symbol.for('WorkerManagerDrivingPort'),

  // Ports Out (Driven Interfaces)
  WorkerInfrastructureDrivenPort: Symbol.for('WorkerInfrastructureDrivenPort'),
  MonitoringInfrastructure: Symbol.for('MonitoringInfrastructure'),

  // Domain Services
  RoutingService: Symbol.for('RoutingService'),

  // Use Cases
  RouteTradesUseCase: Symbol.for('RouteTradesUseCase'),
  AssignSymbolToWorkerUseCase: Symbol.for('AssignSymbolToWorkerUseCase'),
  RemoveSymbolFromWorkerUseCase: Symbol.for('RemoveSymbolFromWorkerUseCase'),
  GetRoutingStatusUseCase: Symbol.for('GetRoutingStatusUseCase'),
  BalanceWorkersUseCase: Symbol.for('BalanceWorkersUseCase'),
  InitializeSymbolRoutingUseCase: Symbol.for('InitializeSymbolRoutingUseCase'),
  BalanceWorkerLoadUseCase: Symbol.for('BalanceWorkerLoadUseCase'),

  // Application Services
  TradeRouterService: Symbol.for('TradeRouterService'),
  WorkerManagerService: Symbol.for('WorkerManagerService'),

  // Repositories
  WorkerRepository: Symbol.for('WorkerRepository'),

  // Infrastructure Services
  WorkerIPCService: Symbol.for('WorkerIPCService'),
} as const;

export type TradeRouterTypes = typeof TRADE_ROUTER_TYPES;
