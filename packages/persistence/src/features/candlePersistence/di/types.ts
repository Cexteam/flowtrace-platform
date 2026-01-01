/**
 * CandlePersistence DI Types
 * Separated from module.ts to avoid circular dependency.
 */

// =============================================================================
// DI Types
// =============================================================================

export const CANDLE_PERSISTENCE_TYPES = {
  CandlePersistencePort: Symbol.for('CandlePersistencePort'),
  CandleStoragePort: Symbol.for('CandleStoragePort'),
  PersistCandleUseCase: Symbol.for('PersistCandleUseCase'),
  CandleHandler: Symbol.for('CandleHandler'),
  HybridStorageConfig: Symbol.for('HybridStorageConfig'),
  StorageConfig: Symbol.for('StorageConfig'),
  UseDatabaseStorage: Symbol.for('UseDatabaseStorage'),
  OrganizeByExchange: Symbol.for('OrganizeByExchange'),
} as const;
