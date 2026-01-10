/**
 * MarketData Feature DI Types
 *
 * Defines dependency injection symbols for the marketData feature.
 *
 */

export const MARKET_DATA_TYPES = {
  SymbolFetcher: Symbol.for('MarketData.SymbolFetcher'),
  TradeStreamAdapter: Symbol.for('MarketData.TradeStreamAdapter'),
  TradeStreamPort: Symbol.for('MarketData.TradeStreamPort'),
  TradeNormalizer: Symbol.for('MarketData.TradeNormalizer'),
  TradeIngestionPort: Symbol.for('MarketData.TradeIngestionPort'),
  TradeRepository: Symbol.for('MarketData.TradeRepository'),
  InitializeFootprintCalculationUseCase: Symbol.for(
    'MarketData.InitializeFootprintCalculationUseCase'
  ),
  AddSymbolsToIngestionUseCase: Symbol.for(
    'MarketData.AddSymbolsToIngestionUseCase'
  ),
  RemoveSymbolsFromIngestionUseCase: Symbol.for(
    'MarketData.RemoveSymbolsFromIngestionUseCase'
  ),
  // Hexagonal Ports
  SnapshotPersistencePort: Symbol.for('MarketData.SnapshotPersistencePort'),
  ExchangeConfigPort: Symbol.for('MarketData.ExchangeConfigPort'),

  // Zero-Gap WebSocket Reconnection
  ConnectionRotator: Symbol.for('MarketData.ConnectionRotator'),
} as const;
