/**
 * CandlePersistence DI Module
 * Feature-centric DI module for candle persistence.
 */

import { Container } from 'inversify';
import type { NormalizedStorageConfig } from '../../../lib/validation/StorageConfigValidator.js';

// Feature components
import { CandlePersistenceService } from '../application/services/CandlePersistenceService.js';
import { PersistCandleUseCase } from '../application/use-cases/PersistCandle/PersistCandleUseCase.js';
import { HybridStorageAdapter } from '../infrastructure/adapters/HybridStorageAdapter.js';
import type { HybridStorageConfig } from '../infrastructure/adapters/HybridStorageAdapter.js';
import type { CandlePersistencePort } from '../application/ports/in/CandlePersistencePort.js';
import type { CandleStoragePort } from '../application/ports/out/CandleStoragePort.js';

// Re-export types from types.ts
export { CANDLE_PERSISTENCE_TYPES } from './types.js';
import { CANDLE_PERSISTENCE_TYPES } from './types.js';
export type { NormalizedStorageConfig } from '../../../lib/validation/StorageConfigValidator.js';

// =============================================================================
// Binding Registration
// =============================================================================

export function registerCandlePersistenceBindings(
  container: Container,
  config: NormalizedStorageConfig
): void {
  // Config
  const hybridConfig: HybridStorageConfig = { ...config };
  container
    .bind<HybridStorageConfig>(CANDLE_PERSISTENCE_TYPES.HybridStorageConfig)
    .toConstantValue(hybridConfig);

  container.bind(CANDLE_PERSISTENCE_TYPES.StorageConfig).toConstantValue({
    baseDir: config.baseDir,
    maxCandlesPerBlock: config.maxCandlesPerBlock,
  });

  container
    .bind<boolean>(CANDLE_PERSISTENCE_TYPES.UseDatabaseStorage)
    .toConstantValue(config.useDatabase);

  container
    .bind<boolean>(CANDLE_PERSISTENCE_TYPES.OrganizeByExchange)
    .toConstantValue(config.organizeByExchange);

  // Storage adapter (outbound port)
  container
    .bind<CandleStoragePort>(CANDLE_PERSISTENCE_TYPES.CandleStoragePort)
    .to(HybridStorageAdapter)
    .inSingletonScope();

  // Use case
  container
    .bind<PersistCandleUseCase>(CANDLE_PERSISTENCE_TYPES.PersistCandleUseCase)
    .to(PersistCandleUseCase)
    .inSingletonScope();

  // Service (inbound port)
  container
    .bind<CandlePersistencePort>(CANDLE_PERSISTENCE_TYPES.CandlePersistencePort)
    .to(CandlePersistenceService)
    .inSingletonScope();
}
