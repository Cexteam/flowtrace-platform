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

  // Hierarchical File Storage
  FileStoragePort: Symbol.for('FileStoragePort'),
  LocalStorageConfig: Symbol.for('LocalStorageConfig'),
  CloudStorageConfig: Symbol.for('CloudStorageConfig'),
  HierarchicalFileStorage: Symbol.for('HierarchicalFileStorage'),
  HierarchicalStorageConfig: Symbol.for('HierarchicalStorageConfig'),

  // Services
  TimeframePartitionStrategy: Symbol.for('TimeframePartitionStrategy'),
  IndexManager: Symbol.for('IndexManager'),
  MetadataManager: Symbol.for('MetadataManager'),

  // Serializers
  CandleOnlySerializer: Symbol.for('CandleOnlySerializer'),
  FootprintOnlySerializer: Symbol.for('FootprintOnlySerializer'),
} as const;
