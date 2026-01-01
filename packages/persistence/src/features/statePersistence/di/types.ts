/**
 * StatePersistence DI Types
 * Separated from module.ts to avoid circular dependency.
 */

// =============================================================================
// DI Types
// =============================================================================

export const STATE_PERSISTENCE_TYPES = {
  // Inbound Ports
  StatePersistencePort: Symbol.for('StatePersistencePort'),
  GapPersistencePort: Symbol.for('GapPersistencePort'),

  // Outbound Ports
  StateStoragePort: Symbol.for('StateStoragePort'),
  GapStoragePort: Symbol.for('GapStoragePort'),

  // Services
  StatePersistenceService: Symbol.for('StatePersistenceService'),
  GapPersistenceService: Symbol.for('GapPersistenceService'),

  // Use Cases
  SaveStateUseCase: Symbol.for('SaveStateUseCase'),
  LoadStateUseCase: Symbol.for('LoadStateUseCase'),
  SaveGapUseCase: Symbol.for('SaveGapUseCase'),
  LoadGapsUseCase: Symbol.for('LoadGapsUseCase'),

  // Handlers
  StateHandler: Symbol.for('StateHandler'),
  GapHandler: Symbol.for('GapHandler'),
} as const;
