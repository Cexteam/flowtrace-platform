/**
 * Hierarchical File Storage Module
 *
 * Exports all types, services, and serializers for hierarchical file storage.
 */

// Types
export type {
  PartitionPattern,
  PartitionInfo,
  CandleData,
  FootprintData,
  FootprintAgg,
  IndexData,
  TimeframeMetadata,
  CloudProvider,
  CloudStorageConfig,
  HierarchicalStorageConfig,
  PeriodFileHeader,
} from './types.js';

export {
  PERIOD_FILE_HEADER_SIZE,
  PERIOD_FILE_MAGIC,
  PERIOD_FILE_VERSION,
} from './types.js';

// Services
export { TimeframePartitionStrategy } from './services/TimeframePartitionStrategy.js';
export { IndexManager } from './services/IndexManager.js';
export { MetadataManager } from './services/MetadataManager.js';

// Serializers
export {
  CandleOnlySerializer,
  CANDLE_RECORD_SIZE,
} from './serializers/CandleOnlySerializer.js';
export { FootprintOnlySerializer } from './serializers/FootprintOnlySerializer.js';
