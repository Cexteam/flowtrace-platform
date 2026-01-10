/**
 * CandlePersistence DI Module
 * Feature-centric DI module for candle persistence.
 */

import { Container } from 'inversify';
import type { NormalizedStorageConfig } from '../../../lib/validation/StorageConfigValidator.js';

// Feature components
import { CandlePersistenceService } from '../application/services/CandlePersistenceService.js';
import { PersistCandleUseCase } from '../application/use-cases/PersistCandle/PersistCandleUseCase.js';
import { HybridStorageAdapter } from '../infrastructure/adapters/storage/HybridStorageAdapter.js';
import type { HybridStorageConfig } from '../infrastructure/adapters/storage/HybridStorageAdapter.js';
import { LocalFileStorageAdapter } from '../infrastructure/adapters/file/LocalFileStorageAdapter.js';
import { CloudFileStorageAdapter } from '../infrastructure/adapters/file/CloudFileStorageAdapter.js';
import { HierarchicalFileStorage } from '../infrastructure/adapters/storage/HierarchicalFileStorage.js';
import type { CandlePersistencePort } from '../application/ports/in/CandlePersistencePort.js';
import type { CandleStoragePort } from '../application/ports/out/CandleStoragePort.js';
import type { FileStoragePort } from '../application/ports/out/FileStoragePort.js';

// Hierarchical storage components
import type {
  HierarchicalStorageConfig,
  CloudStorageConfig,
} from '../../../infrastructure/storage/hierarchical/types.js';
import { TimeframePartitionStrategy } from '../../../infrastructure/storage/hierarchical/services/TimeframePartitionStrategy.js';
import { CandleOnlySerializer } from '../../../infrastructure/storage/hierarchical/serializers/CandleOnlySerializer.js';
import { FootprintOnlySerializer } from '../../../infrastructure/storage/hierarchical/serializers/FootprintOnlySerializer.js';

// Compressed serializer
import type { CompressedCandleSerializerPort } from '../application/ports/out/CompressedCandleSerializerPort.js';
import { CompressedCandleSerializerAdapter } from '../infrastructure/adapters/serialization/CompressedCandleSerializerAdapter.js';

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
  // Config - map NormalizedStorageConfig to HybridStorageConfig
  // Note: NormalizedStorageConfig uses 'cloud' field, HybridStorageConfig uses 'cloudStorageConfig'
  const hybridConfig: HybridStorageConfig = {
    baseDir: config.baseDir,
    useDatabase: config.useDatabase,
    fileStorageLocation: config.fileStorageLocation,
    cloudStorageConfig: config.cloud as CloudStorageConfig | undefined,
    organizeByExchange: config.organizeByExchange,
    maxCandlesPerBlock: config.maxCandlesPerBlock,
    walMode: config.walMode,
    cacheSize: config.cacheSize,
    mmapSize: config.mmapSize,
  };
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

  // Hierarchical storage config
  const hierarchicalConfig: HierarchicalStorageConfig = {
    baseDir: config.baseDir,
    fileStorageLocation: config.fileStorageLocation,
    cloud: config.cloud as CloudStorageConfig | undefined,
    autoUpdateMetadata: true,
  };
  container
    .bind<HierarchicalStorageConfig>(
      CANDLE_PERSISTENCE_TYPES.HierarchicalStorageConfig
    )
    .toConstantValue(hierarchicalConfig);

  // Local storage config
  container
    .bind(CANDLE_PERSISTENCE_TYPES.LocalStorageConfig)
    .toConstantValue({ baseDir: config.baseDir });

  // File storage adapter - choose based on fileStorageLocation
  if (config.fileStorageLocation === 'cloud' && config.cloud) {
    // Cloud storage (GCS)
    container
      .bind<CloudStorageConfig>(CANDLE_PERSISTENCE_TYPES.CloudStorageConfig)
      .toConstantValue(config.cloud as CloudStorageConfig);
    container
      .bind<FileStoragePort>(CANDLE_PERSISTENCE_TYPES.FileStoragePort)
      .to(CloudFileStorageAdapter)
      .inSingletonScope();
  } else {
    // Local storage (default)
    container
      .bind<FileStoragePort>(CANDLE_PERSISTENCE_TYPES.FileStoragePort)
      .to(LocalFileStorageAdapter)
      .inSingletonScope();
  }

  // Hierarchical file storage
  container
    .bind<HierarchicalFileStorage>(
      CANDLE_PERSISTENCE_TYPES.HierarchicalFileStorage
    )
    .to(HierarchicalFileStorage)
    .inSingletonScope();

  // Services
  container
    .bind<TimeframePartitionStrategy>(
      CANDLE_PERSISTENCE_TYPES.TimeframePartitionStrategy
    )
    .toConstantValue(new TimeframePartitionStrategy());

  // Serializers
  container
    .bind<CandleOnlySerializer>(CANDLE_PERSISTENCE_TYPES.CandleOnlySerializer)
    .toConstantValue(new CandleOnlySerializer());

  container
    .bind<FootprintOnlySerializer>(
      CANDLE_PERSISTENCE_TYPES.FootprintOnlySerializer
    )
    .toConstantValue(new FootprintOnlySerializer());

  // Compressed candle serializer (FlatBuffer + LZ4)
  container
    .bind<CompressedCandleSerializerPort>(
      CANDLE_PERSISTENCE_TYPES.CompressedCandleSerializerPort
    )
    .to(CompressedCandleSerializerAdapter)
    .inSingletonScope();

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
