/**
 * MainThread namespace - Configuration functions for main thread context
 *
 * Available features:
 * - CandleProcessing: Aggregates candle data from workers
 * - SymbolManagement: Manages trading symbols and sync
 * - TradeRouter: Routes trades to workers
 * - WorkerManagement: Manages worker pool lifecycle
 * - MarketData: Ingests trade data from exchanges
 * - ExchangeManagement: Manages exchange configurations
 *
 */

import { Container } from 'inversify';
import { configureCandleProcessingMain } from '../bindings/features/candleProcessing/index.js';
import { configureSymbolManagement as configureSymbolManagementFeature } from '../bindings/features/symbolManagement/index.js';
import { configureTradeRouter as configureTradeRouterFeature } from '../bindings/features/tradeRouter/index.js';
import { configureWorkerManagement as configureWorkerManagementFeature } from '../bindings/features/workerManagement/index.js';
import { configureMarketData as configureMarketDataFeature } from '../bindings/features/marketData/index.js';
import { configureExchangeManagement as configureExchangeManagementFeature } from '../bindings/features/exchangeManagement/index.js';

/**
 * MainThread namespace
 * Exposes all features available in main thread context
 */
export namespace MainThread {
  /**
   * Configure CandleProcessing for main thread
   *
   * Main thread role: Aggregate candle data from workers, persist to database
   *
   * Services bound:
   * - ProcessTradeUseCase: Application use case for processing trades
   * - InitializeSymbolUseCase: Application use case for initializing symbols
   * - CandleProcessingService: Main application service
   * - MainThreadCandleStorage: In-memory storage for main thread
   * - HybridEventPublisher: Event publisher (Unix Socket + SQLite Queue)
   * - CandleRepository: Database persistence
   *
   * @param container - InversifyJS container
   */
  export function configureCandleProcessing(container: Container): void {
    configureCandleProcessingMain(container);
  }

  /**
   * Configure SymbolManagement for main thread
   *
   * Main thread only: Manages symbol sync cron job and database
   *
   * Services bound:
   * - SymbolManagementService: Main application service for symbol operations
   * - WorkerAssignmentService: Service for managing worker assignments
   * - SyncSymbolsFromExchangeUseCase: Sync symbols from exchange APIs
   * - ActivateSymbolUseCase: Activate a symbol for trading
   * - DeactivateSymbolUseCase: Deactivate a symbol
   * - AssignSymbolToWorkerUseCase: Assign symbol to worker thread
   * - FindAssignmentsByWorkerUseCase: Query assignments by worker ID
   * - FindAssignmentsByExchangeUseCase: Query assignments by exchange
   * - GetAssignmentUseCase: Get assignment by ID
   * - RemoveAssignmentUseCase: Remove worker assignment
   * - SymbolRepository: Symbol persistence (SQLite)
   * - WorkerAssignmentRepository: Worker assignment persistence
   * - ExchangeApiClientFactory: Factory for exchange API clients
   * - SymbolSyncCronJob: Cron job for periodic symbol synchronization
   *
   * @param container - InversifyJS container
   */
  export function configureSymbolManagement(container: Container): void {
    configureSymbolManagementFeature(container);
  }

  /**
   * Configure TradeRouter for main thread
   *
   * Main thread only: Routes trades to appropriate workers
   *
   * Services bound:
   * - TradeRouterService: Main application service for trade routing
   * - RouteTradesUseCase: Route trades to appropriate workers
   * - AssignSymbolToWorkerUseCase: Assign symbol to worker thread
   * - RemoveSymbolFromWorkerUseCase: Remove symbol from worker
   *
   * Note: Use cases inject workerManagement ports directly:
   * - WorkerPoolPort, WorkerCommunicationPort, ConsistentHashRouter
   *
   * @param container - InversifyJS container
   */
  export function configureTradeRouter(container: Container): void {
    configureTradeRouterFeature(container);
  }

  /**
   * Configure WorkerManagement for main thread
   *
   * Main thread only: Manages worker pool, health monitoring
   *
   * Services bound:
   * - WorkerPoolService: Worker pool lifecycle management
   * - WorkerIPCService: Inter-process communication with workers
   * - WorkerHealthMonitorService: Worker health monitoring
   * - SpawnWorkerUseCase: Spawn new worker thread
   * - CheckWorkerHealthUseCase: Check individual worker health
   * - GetSystemHealthUseCase: Get overall system health status
   * - ConsistentHashRouter: Consistent hashing for load distribution
   * - NodeWorkerThreadAdapter: Node.js worker thread adapter
   *
   * @param container - InversifyJS container
   */
  export function configureWorkerManagement(container: Container): void {
    configureWorkerManagementFeature(container);
  }

  /**
   * Configure MarketData for main thread
   *
   * Main thread only: WebSocket connections, trade ingestion
   *
   * Services bound:
   * - TradeIngestionService: Main trade ingestion orchestrator
   * - AddSymbolsToIngestionUseCase: Add symbols to WebSocket subscription
   * - RemoveSymbolsFromIngestionUseCase: Remove symbols from subscription
   * - GapRecoveryUseCase: Recover missing trade data via REST API
   * - TradeStreamPort: WebSocket trade stream adapter (Binance)
   * - RestApiGapRecoveryPort: REST API gap recovery adapter (Binance)
   * - TradeRepository: Trade persistence
   * - SnapshotPersistencePort: Snapshot persistence (IPC-based)
   *
   * @param container - InversifyJS container
   */
  export function configureMarketData(container: Container): void {
    configureMarketDataFeature(container);
  }

  /**
   * Configure ExchangeManagement for main thread
   *
   * Main thread only: Exchange configuration and health monitoring
   *
   * Services bound:
   * - ExchangeManagementService: Main application service for exchange operations
   * - ExchangeRepository: Exchange configuration persistence (SQLite)
   *
   * @param container - InversifyJS container
   */
  export function configureExchangeManagement(container: Container): void {
    configureExchangeManagementFeature(container);
  }
}
