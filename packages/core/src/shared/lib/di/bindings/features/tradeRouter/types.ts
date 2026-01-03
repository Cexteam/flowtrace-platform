/**
 * TradeRouter Feature DI Types
 *
 * Defines dependency injection symbols for the tradeRouter feature.
 */

export const TRADE_ROUTER_TYPES = {
  // Ports In (Driving Interfaces)
  TradeRouterDrivingPort: Symbol.for('TradeRouterDrivingPort'),

  // Use Cases
  RouteTradesUseCase: Symbol.for('RouteTradesUseCase'),
  AssignSymbolToWorkerUseCase: Symbol.for('AssignSymbolToWorkerUseCase'),
  RemoveSymbolFromWorkerUseCase: Symbol.for('RemoveSymbolFromWorkerUseCase'),
} as const;

export type TradeRouterTypes = typeof TRADE_ROUTER_TYPES;
