/**
 * CandleProcessing Feature DI Types
 *
 * Defines dependency injection symbols for the candleProcessing feature.
 *
 */

export const CANDLE_PROCESSING_TYPES = {
  // Ports (Interfaces)
  CandleStoragePort: Symbol.for('CandleStoragePort'),
  EventPublisherPort: Symbol.for('EventPublisherPort'),
  SymbolConfigPort: Symbol.for('SymbolConfigPort'),
  CandleProcessingPort: Symbol.for('CandleProcessingPort'),
  StatePersistencePort: Symbol.for('StatePersistencePort'),
  GapPersistencePort: Symbol.for('GapPersistencePort'),

  // Use Cases
  ProcessTradeUseCase: Symbol.for('ProcessTradeUseCase'),
  InitializeSymbolUseCase: Symbol.for('InitializeSymbolUseCase'),

  // Services
  CandleProcessingService: Symbol.for('CandleProcessingService'),
  StatePersistenceService: Symbol.for('StatePersistenceService'),

  // Domain Services
  FootprintCalculator: Symbol.for('FootprintCalculator'),
  TimeframeRollup: Symbol.for('TimeframeRollup'),

  // Repository
  CandleRepository: Symbol.for('CandleRepository'),
} as const;
