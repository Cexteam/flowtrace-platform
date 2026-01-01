/**
 * @flowtrace/api - Main Entry Point
 *
 * This package provides REST and WebSocket API endpoints for the FlowTrace platform.
 * It uses NestJS with Fastify adapter for high performance.
 */

// Ensure reflect-metadata is loaded for decorators
import 'reflect-metadata';

// App Module
export { AppModule, type AppModuleOptions } from './app.module.js';

// Bridge Module (NestJS-Inversify bridge)
export { InversifyBridgeModule, BRIDGE_TOKENS } from './bridge/index.js';

// Core Module (Legacy DI bridge - kept for backward compatibility)
export { CoreModule, CORE_TOKENS } from './modules/core/core.module.js';

// ============================================================================
// NEW Feature Modules (features/ pattern)
// ============================================================================

// Symbols Feature - Shared Service for HTTP/IPC reuse
export {
  SymbolsModule as SymbolsFeatureModule,
  SymbolsService,
  type SymbolsFilter,
  type PaginatedSymbolsResponse,
} from './features/symbols/index.js';
export { SymbolsController as SymbolsFeatureController } from './features/symbols/index.js';

// Exchanges Feature - Shared Service for HTTP/IPC reuse
export {
  ExchangesModule as ExchangesFeatureModule,
  ExchangesService,
  type ExchangesFilter,
  type PaginatedExchangesResponse,
} from './features/exchanges/index.js';
export { ExchangesController as ExchangesFeatureController } from './features/exchanges/index.js';

// Workers Feature - Shared Service for HTTP/IPC reuse
export {
  WorkersModule as WorkersFeatureModule,
  WorkersService,
} from './features/workers/index.js';
export { WorkersController as WorkersFeatureController } from './features/workers/index.js';

// DataQuality Feature - Shared Service for HTTP/IPC reuse
export {
  DataQualityModule as DataQualityFeatureModule,
  DataQualityService,
  GAP_READER_TOKEN,
  type GapCheckParams,
  type GetGapsByExchangeParams,
  type PaginatedGapsResponse,
  type GapRecordDto,
} from './features/dataQuality/index.js';

// ============================================================================
// Footprint Feature (includes historical candle data)
// ============================================================================

export {
  FootprintModule,
  FootprintService,
  CANDLE_READER_TOKEN,
  type FootprintFilter,
  type GetCandleDetailParams,
  type PriceLevel,
  type CandleDetailResponse,
  type GetCompletedCandlesParams,
  type CompletedCandle,
  type PaginatedCompletedCandlesResponse,
} from './features/footprint/index.js';
export { FootprintController } from './features/footprint/index.js';

// DTOs - Footprint
export {
  GetFootprintDto,
  FootprintParamsDto,
  FootprintResponseDto,
  FootprintListResponseDto,
  PriceBinDto,
  VALID_TIMEFRAMES as FOOTPRINT_TIMEFRAMES,
  type ValidTimeframe as FootprintTimeframe,
  type ValidTimeframe,
} from './features/footprint/index.js';

// ============================================================================
// WebSocket Feature (migrated to features/ pattern)
// ============================================================================

export {
  WebSocketModule,
  CandleGateway,
  StatusGateway,
} from './features/websocket/index.js';

// Re-export new feature modules with legacy names for backward compatibility
export { SymbolsModule } from './features/symbols/index.js';
export { SymbolsController } from './features/symbols/index.js';

// DTOs - Symbols (from new features structure)
export {
  SymbolResponseDto,
  SymbolListResponseDto,
  SymbolActivationResponseDto,
  SymbolQueryDto,
  CreateSymbolDto,
  UpdateSymbolDto,
  VALID_EXCHANGES,
  VALID_SYMBOL_STATUS,
  type ValidExchange,
  type ValidSymbolStatus,
} from './features/symbols/presentation/dto/index.js';

// DTOs - Exchanges (from new features structure)
export {
  ExchangeResponseDto,
  ExchangeListResponseDto,
  ExchangeHealthResponseDto,
  ExchangeToggleResponseDto,
  VALID_EXCHANGES as EXCHANGE_VALID_EXCHANGES,
  type ValidExchange as ExchangeValidExchange,
  type ImplementationStatus,
} from './features/exchanges/presentation/dto/index.js';

// DTOs - Workers (from new features structure)
export {
  WorkerResponseDto,
  WorkerListResponseDto,
  WorkerHealthResponseDto,
  WorkerHealthMetricsDto,
  SpawnWorkerDto,
  SpawnWorkerResponseDto,
  WorkerStatsDto,
} from './features/workers/presentation/dto/index.js';

// DTOs - DataQuality (from new features structure)
export {
  GapCheckResponseDto,
  GapCheckRangeDto,
  DataGapDto,
} from './features/dataQuality/presentation/dto/index.js';

// ============================================================================
// Bootstrap API - Centralized initialization for server and context modes
// ============================================================================

/**
 * Bootstrap function for initializing the FlowTrace API application.
 *
 * Provides a clean, unified API for starting the application in either:
 * - **Server mode**: Full HTTP server with Fastify, validation, CORS, and Swagger
 * - **Context mode**: Application context only (for desktop apps, CLI tools, testing)
 *
 * All NestJS configuration is handled internally, eliminating boilerplate in consuming apps.
 * Works with the unified SQLite architecture - all deployments use the same container configuration.
 *
 * @example Server mode - Start HTTP server
 * ```typescript
 * import { bootstrap } from '@flowtrace/core';
 * import { bootstrap as bootstrapApi } from '@flowtrace/api';
 *
 * // Unified architecture - no platform parameter needed
 * const { container } = await bootstrap();
 * const { app, url } = await bootstrapApi(container, {
 *   mode: 'server',
 *   port: 3001,
 *   host: '0.0.0.0',
 *   enableSwagger: true,
 *   enableCors: true
 * });
 * console.log(`Server running on ${url}`);
 * ```
 *
 * @example Context mode - Desktop application
 * ```typescript
 * import { bootstrap } from '@flowtrace/core';
 * import { bootstrap as bootstrapApi, SymbolsService } from '@flowtrace/api';
 *
 * // Unified architecture - same bootstrap for all deployments
 * const { container } = await bootstrap();
 * const { app } = await bootstrapApi(container, {
 *   mode: 'context'
 * });
 *
 * // Access services via dependency injection
 * const symbolsService = app.get(SymbolsService);
 * const symbols = await symbolsService.findAll();
 * ```
 *
 * @example Silent mode - Testing
 * ```typescript
 * const { app } = await bootstrap(testContainer, {
 *   mode: 'context',
 *   silent: true  // Suppress console logs
 * });
 * ```
 *
 * @param container - Inversify container from @flowtrace/core
 * @param options - Bootstrap options (mode-specific)
 * @returns Bootstrap result with configured NestJS instance and close() method
 * @throws {BootstrapError} If container is invalid or initialization fails
 *
 * @see {@link BootstrapOptions} for all available options
 * @see {@link BootstrapResult} for return type details
 */
export { bootstrap } from './bootstrap.js';

/**
 * Bootstrap types and utilities
 *
 * - `BootstrapOptions`: Discriminated union of server/context options
 * - `BootstrapResult`: Discriminated union of server/context results
 * - `BootstrapError`: Custom error class with error codes
 * - Type guards: `isServerBootstrapOptions`, `isContextBootstrapOptions`, etc.
 */
export {
  // Options types
  type BootstrapOptions,
  type ServerBootstrapOptions,
  type ContextBootstrapOptions,
  type BaseBootstrapOptions,
  // Result types
  type BootstrapResult,
  type ServerBootstrapResult,
  type ContextBootstrapResult,
  // Error handling
  BootstrapError,
  BootstrapErrorCodes,
  type BootstrapErrorCode,
  // Type guards
  isServerBootstrapOptions,
  isContextBootstrapOptions,
  isServerBootstrapResult,
  isContextBootstrapResult,
} from './bootstrap.types.js';
