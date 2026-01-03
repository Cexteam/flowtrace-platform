/**
 * SymbolManagement Feature DI Types
 *
 * Defines dependency injection symbols for the symbolManagement feature.
 * Following Hexagonal Architecture pattern with ports and adapters.
 *
 */

export const SYMBOL_MANAGEMENT_TYPES = {
  // Application Ports (Inbound Ports)
  SymbolManagementPort: Symbol.for('SymbolManagement.SymbolManagementPort'),

  // Application Ports (Outbound Ports)
  // Note: Exchange-related ports moved to exchangeManagement feature

  // Use Cases
  SyncSymbolsFromExchangeUseCase: Symbol.for(
    'SymbolManagement.SyncSymbolsFromExchangeUseCase'
  ),
  ActivateSymbolUseCase: Symbol.for('SymbolManagement.ActivateSymbolUseCase'),
  DeactivateSymbolUseCase: Symbol.for(
    'SymbolManagement.DeactivateSymbolUseCase'
  ),

  // Domain Repositories (Outbound Ports)
  SymbolRepository: Symbol.for('SymbolManagement.SymbolRepository'),
} as const;

export type SymbolManagementTypes = typeof SYMBOL_MANAGEMENT_TYPES;
