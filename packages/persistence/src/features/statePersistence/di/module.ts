/**
 * StatePersistence DI Module
 * Feature-centric DI module that contains both types and bindings for the
 * statePersistence feature.
 */

import { Container } from 'inversify';

// Import feature components - Adapters (outbound)
import { RuntimeStateStorageAdapter } from '../infrastructure/adapters/RuntimeStateStorageAdapter.js';
import { RuntimeGapStorageAdapter } from '../infrastructure/adapters/RuntimeGapStorageAdapter.js';

// Import feature components - Services
import { StatePersistenceService } from '../application/services/StatePersistenceService.js';
import { GapPersistenceService } from '../application/services/GapPersistenceService.js';

// Import feature components - Use Cases
import { SaveStateUseCase } from '../application/use-cases/SaveState/SaveStateUseCase.js';
import { LoadStateUseCase } from '../application/use-cases/LoadState/LoadStateUseCase.js';
import { SaveGapUseCase } from '../application/use-cases/SaveGap/SaveGapUseCase.js';
import { LoadGapsUseCase } from '../application/use-cases/LoadGaps/LoadGapsUseCase.js';

// Import feature components - Handlers
import { StateHandler } from '../infrastructure/handlers/StateHandler.js';
import { GapHandler } from '../infrastructure/handlers/GapHandler.js';

// Import port types - Outbound
import type { StateStoragePort } from '../application/ports/out/StateStoragePort.js';
import type { GapStoragePort } from '../application/ports/out/GapStoragePort.js';

// Import port types - Inbound
import type { StatePersistencePort } from '../application/ports/in/StatePersistencePort.js';
import type { GapPersistencePort } from '../application/ports/in/GapPersistencePort.js';

// Re-export types from types.ts
export { STATE_PERSISTENCE_TYPES } from './types.js';
import { STATE_PERSISTENCE_TYPES } from './types.js';

// =============================================================================
// Binding Registration
// =============================================================================

export function registerStatePersistenceBindings(container: Container): void {
  // Outbound Ports (Storage Adapters)
  container
    .bind<StateStoragePort>(STATE_PERSISTENCE_TYPES.StateStoragePort)
    .to(RuntimeStateStorageAdapter)
    .inSingletonScope();

  container
    .bind<GapStoragePort>(STATE_PERSISTENCE_TYPES.GapStoragePort)
    .to(RuntimeGapStorageAdapter)
    .inSingletonScope();

  // Use Cases
  container
    .bind<SaveStateUseCase>(STATE_PERSISTENCE_TYPES.SaveStateUseCase)
    .to(SaveStateUseCase)
    .inSingletonScope();

  container
    .bind<LoadStateUseCase>(STATE_PERSISTENCE_TYPES.LoadStateUseCase)
    .to(LoadStateUseCase)
    .inSingletonScope();

  container
    .bind<SaveGapUseCase>(STATE_PERSISTENCE_TYPES.SaveGapUseCase)
    .to(SaveGapUseCase)
    .inSingletonScope();

  container
    .bind<LoadGapsUseCase>(STATE_PERSISTENCE_TYPES.LoadGapsUseCase)
    .to(LoadGapsUseCase)
    .inSingletonScope();

  // Services (Inbound Port Implementations)
  container
    .bind<StatePersistenceService>(
      STATE_PERSISTENCE_TYPES.StatePersistenceService
    )
    .to(StatePersistenceService)
    .inSingletonScope();

  container
    .bind<StatePersistencePort>(STATE_PERSISTENCE_TYPES.StatePersistencePort)
    .toDynamicValue((context) =>
      context.container.get<StatePersistenceService>(
        STATE_PERSISTENCE_TYPES.StatePersistenceService
      )
    )
    .inSingletonScope();

  container
    .bind<GapPersistenceService>(STATE_PERSISTENCE_TYPES.GapPersistenceService)
    .to(GapPersistenceService)
    .inSingletonScope();

  container
    .bind<GapPersistencePort>(STATE_PERSISTENCE_TYPES.GapPersistencePort)
    .toDynamicValue((context) =>
      context.container.get<GapPersistenceService>(
        STATE_PERSISTENCE_TYPES.GapPersistenceService
      )
    )
    .inSingletonScope();

  // Handlers
  container
    .bind<StateHandler>(STATE_PERSISTENCE_TYPES.StateHandler)
    .to(StateHandler)
    .inSingletonScope();

  container
    .bind<GapHandler>(STATE_PERSISTENCE_TYPES.GapHandler)
    .to(GapHandler)
    .inSingletonScope();
}
