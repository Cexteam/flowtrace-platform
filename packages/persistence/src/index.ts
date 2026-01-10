/**
 * @module @flowtrace/persistence
 * @description Candle persistence service with bootstrap pattern and read-only candle access.
 *
 * This module provides two main entry points:
 * 1. `bootstrap` - For starting the full persistence worker process
 * 2. `createCandleReader` - For read-only candle access without DI container
 * 3. `createGapReader` - For read-only gap records access without DI container
 *
 * @example
 * // Full worker bootstrap
 * import { bootstrap } from '@flowtrace/persistence';
 * const app = await bootstrap({
 *   socketPath: '/tmp/flowtrace.sock',
 *   runtimeDbPath: '/data/runtime.db',
 *   storage: { baseDir: '/data/candles' }
 * });
 * await app.start();
 *
 * @example
 * // Read-only candle access
 * import { createCandleReader } from '@flowtrace/persistence';
 * const reader = createCandleReader({ dbPath: '/data/candles.db' });
 * const candles = await reader.findBySymbol('BTCUSDT', 'binance', '1m');
 * await reader.close();
 *
 * @example
 * // Read-only gap access
 * import { createGapReader } from '@flowtrace/persistence';
 * const reader = createGapReader({ dbPath: '/data/runtime.db' });
 * const { gaps, totalCount } = await reader.loadGaps({ symbol: 'BTCUSDT' });
 * await reader.close();
 *
 * @packageDocumentation
 */

// MUST be first import for Inversify decorators to work correctly
import 'reflect-metadata';

// =============================================================================
// Bootstrap - Primary Entry Point (Minimal Public API)
// =============================================================================

export { bootstrap, type PersistenceBootstrapConfig } from './bootstrap.js';

// =============================================================================
// Candle Reader - Read-Only Access (No DI Required)
// =============================================================================

export {
  createCandleReader,
  type CandleReaderConfig,
} from './features/candlePersistence/index.js';

export type {
  CandleReaderPort,
  FootprintCandleResult,
  CandleAggregation,
} from './features/candlePersistence/application/ports/in/CandleReaderPort.js';

// =============================================================================
// Gap Reader - Read-Only Access (No DI Required)
// =============================================================================

export {
  createGapReader,
  type GapReaderPort,
  type GapRecord,
  type GapLoadOptions,
  type PaginatedGapsResult,
  type ReadOnlyGapStorageConfig as GapReaderConfig,
} from './features/statePersistence/infrastructure/adapters/ReadOnlyGapStorage.js';

// IPC-based Gap Reader (for main process to read via persistence worker)
export {
  createIPCGapReader,
  type IPCGapReaderAdapterConfig,
} from './features/statePersistence/infrastructure/adapters/IPCGapReaderAdapter.js';

// =============================================================================
// Hierarchical File Storage - Types and Services
// =============================================================================

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
} from './infrastructure/storage/hierarchical/index.js';

export {
  PERIOD_FILE_HEADER_SIZE,
  PERIOD_FILE_MAGIC,
  PERIOD_FILE_VERSION,
  TimeframePartitionStrategy,
  IndexManager,
  MetadataManager,
  CandleOnlySerializer,
  CANDLE_RECORD_SIZE,
  FootprintOnlySerializer,
} from './infrastructure/storage/hierarchical/index.js';
