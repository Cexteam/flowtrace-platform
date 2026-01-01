/**
 * @flowtrace/core - Main Entry Point
 *
 * This package contains all business logic features and shared utilities
 * for the FlowTrace platform.
 */

// Ensure reflect-metadata is loaded for DI
import 'reflect-metadata';

// ============================================================================
// Features - Namespaced exports to avoid conflicts
// ============================================================================

// Candle Processing Feature
import * as CandleProcessingDomain from './features/candleProcessing/domain/index.js';
import * as CandleProcessingApplication from './features/candleProcessing/application/index.js';
import * as CandleProcessingInfrastructure from './features/candleProcessing/infrastructure/index.js';

export {
  CandleProcessingDomain,
  CandleProcessingApplication,
  CandleProcessingInfrastructure,
};

// Re-export commonly used items directly (from candleProcessing domain)
export {
  Timeframe,
  TimeframeName,
  TIMEFRAME_SECONDS,
  TIMEFRAME_INTERVALS,
  TradeData,
  RawTrade,
  createTradeData,
  FootprintCandle,
  FootprintCandleDTO,
  CandleGroup,
  CandleGroupDTO,
  PriceBin,
  Aggs,
  FootprintCalculator,
  TimeframeRollup,
  CandleCompletionDetector,
  SymbolConfig as CandleSymbolConfig,
  createDefaultSymbolConfig,
} from './features/candleProcessing/domain/index.js';

export {
  CandleProcessingPort,
  ProcessTradeRequest,
  ProcessTradeResult,
  ProcessTradeUseCase,
  InitializeSymbolUseCase,
  CandleProcessingService,
  CANDLE_PROCESSING_TYPES,
} from './features/candleProcessing/application/index.js';

export {
  // Note: WorkerEventPublisher and MainThreadEventPublisher have been replaced by HybridEventPublisher
  // Note: WorkerCandleStorage and MainThreadCandleStorage have been replaced by unified CandleStorage
  // Note: WorkerSymbolConfig has been replaced by unified SymbolConfigAdapter
  HybridEventPublisher,
  CandleStorage,
  SymbolConfigAdapter,
} from './features/candleProcessing/infrastructure/index.js';

// Market Data Feature
import * as MarketData from './features/marketData/index.js';
export { MarketData };

export { TradeIngestionService } from './features/marketData/application/services/index.js';

export { BinanceWsTradeStreamAdapter } from './features/marketData/infrastructure/adapters/index.js';

export { WebSocketManager } from './features/marketData/infrastructure/services/index.js';

// Symbol Management Feature
import * as SymbolManagement from './features/symbolManagement/index.js';
export { SymbolManagement };

export {
  Symbol,
  SymbolStatus,
  SymbolConfig,
  SymbolManagementService,
  WorkerAssignmentService,
  SyncSymbolsFromExchangeUseCase,
  ActivateSymbolUseCase,
  DeactivateSymbolUseCase,
  configureSymbolManagement,
  SYMBOL_MANAGEMENT_TYPES,
} from './features/symbolManagement/index.js';

export type {
  WorkerAssignment,
  SymbolRepository,
  Exchange as SymbolExchange,
  ExchangeMetadata,
  SymbolManagementPort,
  WorkerAssignmentServicePort,
  // ExchangeApiClient, // Moved to exchangeManagement
  // ExchangeSymbol, // Moved to exchangeManagement
} from './features/symbolManagement/index.js';

// Exchange Management Feature
export {
  ExchangeManagementService,
  BinanceExchangeApiAdapter,
  BybitExchangeApiAdapter,
  OKXExchangeApiAdapter,
  ExchangeApiClientFactory,
  // Note: DrizzleExchangeConfigRepository replaced by DrizzleExchangeRepository
  configureExchangeManagement,
  EXCHANGE_MANAGEMENT_TYPES,
} from './features/exchangeManagement/index.js';

// Trade Router Feature
import * as TradeRouter from './features/tradeRouter/index.js';
export { TradeRouter };

export {
  WorkerThread,
  HashRing,
  TradeRouterService,
  WorkerManagerService,
  RoutingService,
} from './features/tradeRouter/index.js';

export type {
  TradeRouterDrivingPort,
  WorkerManagerDrivingPort,
  WorkerInfrastructureDrivenPort,
} from './features/tradeRouter/index.js';

// Worker Management Feature
import * as WorkerManagement from './features/workerManagement/index.js';
export { WorkerManagement };

export type {
  WorkerPoolPort,
  WorkerPoolStatus,
  WorkerPoolConfig,
  WorkerHealthMonitorPort,
  WorkerHealthStatus,
  SystemHealthOverview,
} from './features/workerManagement/application/index.js';

// Exchange Management Feature
import * as ExchangeManagement from './features/exchangeManagement/index.js';
export { ExchangeManagement };

export {
  Exchange,
  ExchangeStatus,
} from './features/exchangeManagement/index.js';

export type {
  ExchangeProps,
  ExchangeHealth,
  ImplementationStatus,
  ExchangeRepository,
  ExchangeManagementPort,
  ExchangeFilter,
} from './features/exchangeManagement/index.js';

// ============================================================================
// Shared Utilities
// ============================================================================

// DI configuration
export * from './shared/lib/di/index.js';

// Logger
export { logger, createLogger } from './shared/lib/logger/logger.js';

// Trading algorithms - Additional exports from candleProcessing domain
export {
  // Additional Value Objects
  isBuyTrade,
  isSellTrade,
  getQuoteVolume,
  Trade,
  Trades,

  // Additional Entities
  mergeAggsArrays,

  // Additional Services
  calculateBinPrice,
  applyTradeToAggs,
  mergeAggs,
  applyTradeToCandle,
  calculateVolumeStats,
  calculateDelta,
  CalAggsFootprint,
  mergeFootprintAggs,
  calculateVolumeDelta,
  normalizePrice,
  validateTradePrice,
  RollupResult,
  rollup,
  calculateOpentime,
  calculateCheckTime,
  hasTimeframeCrossed,
  shouldComplete,
  calculateCompletionTime,
  getPeriodStart,
  getPeriodEnd,
  isSamePeriod,
} from './features/candleProcessing/domain/index.js';

// Additional types for backward compatibility
export type {
  Candle,
  CandlesOfSymbol,
  TradingPriceBin,
  FootprintBuffer,
} from './features/candleProcessing/domain/index.js';

// All deployments now use IPC-based persistence via SQLite.

// Infrastructure - Database (SQLite only)
export {
  SqliteConfig,
  DatabaseConfig,
  DatabaseMigrator,
  createMigrator,
  bootstrapDatabase,
  bootstrapDatabaseLazy,
  runMigrations,
  bindMigrator,
  DrizzleDatabase,
  DrizzleSqliteDatabase,
} from './shared/infrastructure/database/index.js';
export type {
  MigrationRecord,
  MigrationResult,
  DatabaseBootstrapOptions,
  DatabaseBootstrapResult,
} from './shared/infrastructure/database/index.js';
export * from './shared/infrastructure/database/schema/index.js';
export * from './shared/infrastructure/database/migrations/index.js';

export * from './shared/infrastructure/cache/index.js';

// Environment configuration
export * from './env/index.js';

// ============================================================================
// Bootstrap - Application Lifecycle (see bootstrap.ts for details)
// ============================================================================
export {
  bootstrap,
  FlowTraceApplication,
  FlowTraceApplicationOptions,
  FlowTraceApplicationStatus,
  type BootstrapResult,
} from './bootstrap.js';

// Worker script path - for use by NodeWorkerThreadAdapter
// This allows both server and desktop to use the same worker script from core
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the directory path using import.meta.url (ESM)
// Note: This file is compiled to ESM and should always have import.meta available
// For Jest tests that transform to CommonJS, the api package should use the dist/ output
const _coreFilename = fileURLToPath(import.meta.url);
const _coreDirname = path.dirname(_coreFilename);

/**
 * Get the path to the worker script in the core package
 * This is the compiled worker.js in the dist folder
 *
 */
export function getWorkerScriptPath(): string {
  // _coreDirname points to dist/ when compiled
  return path.join(_coreDirname, 'worker.js');
}

/**
 * Worker script path constant for backward compatibility
 * @deprecated Use getWorkerScriptPath() instead
 */
export const WORKER_SCRIPT_PATH = path.join(_coreDirname, 'worker.js');
