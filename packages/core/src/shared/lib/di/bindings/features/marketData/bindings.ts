/**
 * MarketData Feature Core Bindings
 *
 * Configures runtime-agnostic bindings for the MarketData feature.
 * This includes application services, use cases, and infrastructure that
 * doesn't depend on platform-specific adapters.
 *
 * Platform-specific adapters (repositories, snapshot persistence) are
 * configured separately in the adapters/ directory.
 *
 * Services bound in this module:
 * - TradeIngestionService: Main trade ingestion service (inbound port)
 * - AddSymbolsToIngestionUseCase: Add symbols to ingestion
 * - RemoveSymbolsFromIngestionUseCase: Remove symbols from ingestion
 * - BinanceWsTradeStreamAdapter: WebSocket trade stream adapter
 *
 */

import { Container } from 'inversify';
import { MARKET_DATA_TYPES } from './types.js';

// Application Layer - Services
import { TradeIngestionService } from '../../../../../../features/marketData/application/services/TradeIngestionService.js';

// Application Layer - Ports
import { TradeIngestionPort } from '../../../../../../features/marketData/application/ports/in/TradeIngestionPort.js';
import { TradeStreamPort } from '../../../../../../features/marketData/application/ports/out/TradeStreamPort.js';
import type { ExchangeConfigPort } from '../../../../../../features/marketData/application/ports/out/ExchangeConfigPort.js';

// Application Layer - Use Cases
import { AddSymbolsToIngestionUseCase } from '../../../../../../features/marketData/application/use-cases/AddSymbolsToIngestion/AddSymbolsToIngestionUseCase.js';
import { RemoveSymbolsFromIngestionUseCase } from '../../../../../../features/marketData/application/use-cases/RemoveSymbolsFromIngestion/RemoveSymbolsFromIngestionUseCase.js';

// Infrastructure Adapters
import { BinanceWsTradeStreamAdapter } from '../../../../../../features/marketData/infrastructure/adapters/index.js';
import { ExchangeConfigAdapter } from '../../../../../../features/marketData/infrastructure/adapters/ExchangeConfigAdapter.js';

/**
 * Configure MarketData core bindings
 *
 * Binds all platform-agnostic services for the MarketData feature.
 * Platform-specific adapters (TradeRepository, SnapshotPersistence) must
 * be bound separately using the adapter configuration functions.
 *
 * @param container - InversifyJS container
 */
export function configureMarketDataCore(container: Container): void {
  // ========================================
  // APPLICATION LAYER - USE CASES
  // ========================================

  container
    .bind(MARKET_DATA_TYPES.AddSymbolsToIngestionUseCase)
    .to(AddSymbolsToIngestionUseCase)
    .inSingletonScope();

  container
    .bind(MARKET_DATA_TYPES.RemoveSymbolsFromIngestionUseCase)
    .to(RemoveSymbolsFromIngestionUseCase)
    .inSingletonScope();

  // ========================================
  // APPLICATION LAYER - SERVICES (INBOUND PORTS)
  // ========================================

  container
    .bind<TradeIngestionPort>(MARKET_DATA_TYPES.TradeIngestionPort)
    .to(TradeIngestionService)
    .inSingletonScope();

  // Also bind the service directly for cases where it's needed
  container.bind(TradeIngestionService).toSelf().inSingletonScope();

  // ========================================
  // INFRASTRUCTURE LAYER - ADAPTERS (OUTBOUND PORTS)
  // ========================================

  // Trade stream adapter (WebSocket)
  container
    .bind<TradeStreamPort>(MARKET_DATA_TYPES.TradeStreamPort)
    .to(BinanceWsTradeStreamAdapter)
    .inSingletonScope();

  // ExchangeConfigPort → ExchangeConfigAdapter (Port Out binding)
  container
    .bind<ExchangeConfigPort>(MARKET_DATA_TYPES.ExchangeConfigPort)
    .to(ExchangeConfigAdapter)
    .inSingletonScope();
}
