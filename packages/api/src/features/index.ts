/**
 * Features exports
 *
 * This barrel file exports all feature modules and their shared services.
 * Services are exported for use by both HTTP controllers and IPC handlers.
 */

// Symbols Feature
export {
  SymbolsModule,
  SymbolsService,
  type SymbolsFilter,
} from './symbols/index.js';
export type {
  SymbolResponseDto,
  SymbolListResponseDto,
  SymbolActivationResponseDto,
  ValidExchange as SymbolValidExchange,
  ValidSymbolStatus,
} from './symbols/index.js';

// Exchanges Feature
export { ExchangesModule, ExchangesService } from './exchanges/index.js';
export type {
  ExchangeResponseDto,
  ExchangeListResponseDto,
  ExchangeHealthResponseDto,
  ExchangeToggleResponseDto,
  ValidExchange as ExchangeValidExchange,
  ImplementationStatus,
} from './exchanges/index.js';

// Workers Feature
export { WorkersModule, WorkersService } from './workers/index.js';
export type {
  WorkerResponseDto,
  WorkerListResponseDto,
  WorkerHealthResponseDto,
  WorkerHealthMetricsDto,
  SpawnWorkerResponseDto,
  WorkerStatsDto,
} from './workers/index.js';

// DataQuality Feature
export {
  DataQualityModule,
  DataQualityController,
  DataQualityService,
  type GapCheckParams,
  type TradeGapCheckParams,
  type TradeGapResponseDto,
} from './dataQuality/index.js';
export type {
  GapCheckResponseDto,
  GapCheckRangeDto,
  DataGapDto,
} from './dataQuality/index.js';

// Footprint Feature (includes historical candle data)
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
} from './footprint/index.js';
export type {
  FootprintResponseDto,
  FootprintListResponseDto,
  ValidTimeframe,
} from './footprint/index.js';

// WebSocket Feature
export {
  WebSocketModule,
  CandleGateway,
  StatusGateway,
} from './websocket/index.js';
