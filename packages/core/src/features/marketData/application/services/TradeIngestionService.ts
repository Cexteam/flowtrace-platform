import { injectable, inject } from 'inversify';
import { TYPES } from '../../../../shared/lib/di/core/types.js';
import { TradeRouterDrivingPort } from '../../../tradeRouter/application/ports/in/TradeRouterDrivingPort.js';
import {
  AddSymbolsToIngestionUseCase,
  RemoveSymbolsFromIngestionUseCase,
  type AddSymbolsToIngestionRequest,
  type RemoveSymbolsFromIngestionRequest,
} from '../use-cases/index.js';
import {
  SymbolRepository,
  SYMBOL_MANAGEMENT_TYPES,
} from '../../../symbolManagement/index.js';
import { TradeStreamPort } from '../../application/ports/out/TradeStreamPort.js';
import {
  TradeIngestionPort,
  IngestionRequest,
  IngestionResult,
  IngestionStatus,
} from '../ports/in/TradeIngestionPort.js';
import { createLogger } from '../../../../shared/lib/logger/logger.js';
import { env } from '../../../../env/index.js';

// Use trading types from candleProcessing domain
import { Trades } from '../../../candleProcessing/domain/value-objects/TradeData.js';

const logger = createLogger('TradeIngestionService');

/**
 * SERVICE: Orchestrates complete trade data ingestion pipeline
 * From symbol fetching → WebSocket connection → trade routing → workers
 *
 * Ultra-minimal architecture: Direct routing to worker-owned footprint logic
 *
 * ✅ DRIVING PORT IMPLEMENTATION: External actors call application through this interface
 * ✅ CLEAN ARCHITECTURE: Only imports from tradeRouter, not workerManagement
 */
@injectable()
export class TradeIngestionService implements TradeIngestionPort {
  private isRunning = false;
  private connectedSymbols: string[] = [];

  constructor(
    @inject(SYMBOL_MANAGEMENT_TYPES.SymbolRepository)
    private symbolRepository: SymbolRepository,
    @inject(TYPES.TradeRouterDrivingPort)
    private tradeRouterPort: TradeRouterDrivingPort,
    @inject(TYPES.AddSymbolsToIngestionUseCase)
    private addSymbolsUseCase: AddSymbolsToIngestionUseCase,
    @inject(TYPES.RemoveSymbolsFromIngestionUseCase)
    private removeSymbolsUseCase: RemoveSymbolsFromIngestionUseCase,
    @inject(TYPES.TradeStreamPort)
    private tradeStreamPort: TradeStreamPort
  ) {}

  /**
   * Start the complete data ingestion pipeline (Driving Port Implementation)
   */
  async startIngestion(request?: IngestionRequest): Promise<IngestionResult> {
    const startTime = Date.now();

    if (this.isRunning) {
      logger.warn('Trade ingestion service already running');
      return {
        success: false,
        message: 'Service already running',
        connectedSymbols: this.connectedSymbols,
        failedSymbols: [],
        timestamp: new Date(),
      };
    }

    try {
      logger.info('Starting trade ingestion service...');

      // ✅ PHASE 0: Initialize worker pool via tradeRouterPort
      const numWorkers = env.WORKER_THREADS_COUNT || 2;
      const socketPath =
        env.IPC_SOCKET_PATH || '/tmp/flowtrace-persistence.sock';

      logger.info(
        `🚀 Initializing ${numWorkers} worker threads via TradeRouterPort (socketPath: ${socketPath})...`
      );

      await this.tradeRouterPort.initializeWorkerPool({
        workerCount: numWorkers,
        socketPath,
      });

      const status = this.tradeRouterPort.getWorkerPoolStatus();
      logger.info(
        `🚀 Worker pool initialization complete: ${status.healthyWorkers}/${status.totalWorkers} workers healthy`
      );

      // ✅ PHASE 1: Fetch active trading symbols
      const activeSymbols = await this.fetchActiveSymbols();
      logger.info(`Fetched ${activeSymbols.length} active trading symbols`);

      // ✅ Graceful handling: No active symbols - start in standby mode
      if (activeSymbols.length === 0) {
        logger.warn(
          '⚠️ No active symbols found in database. Service starting in standby mode. ' +
            'Activate symbols via admin panel or API to begin trade ingestion.'
        );

        // Still need to initialize workers with socketPath for dynamic symbol addition
        await this.tradeRouterPort.initializeSymbolRouting([], socketPath);

        // Register trade callback for when symbols are added dynamically
        this.tradeStreamPort.setTradeCallback((trades: Trades) => {
          this.processTrades(trades);
        });

        this.isRunning = true;
        this.connectedSymbols = [];

        const elapsedMs = Date.now() - startTime;
        return {
          success: true,
          message:
            'Service started in standby mode (no active symbols). Activate symbols to begin ingestion.',
          connectedSymbols: [],
          failedSymbols: [],
          timestamp: new Date(),
          metadata: {
            connectionId: `${Date.now()}`,
            elapsedMs,
            standbyMode: true,
          },
        };
      }

      // ✅ PHASE 2: Initialize symbol routing to workers via tradeRouterPort
      logger.info('Initializing symbol routing...');
      const routingResult = await this.tradeRouterPort.initializeSymbolRouting(
        activeSymbols,
        socketPath
      );
      logger.info(
        `Symbol routing initialized: ${routingResult.assignedSymbols}/${activeSymbols.length} symbols assigned`
      );

      // ✅ PHASE 3: Register trade callback through port
      this.tradeStreamPort.setTradeCallback((trades: Trades) => {
        this.processTrades(trades);
      });

      // ✅ PHASE 4: Connect to WebSocket streams (LAST - only after routing is ready)
      await this.tradeStreamPort.connect(activeSymbols);
      this.connectedSymbols = activeSymbols;

      this.isRunning = true;
      logger.info('Trade ingestion service started successfully');

      const elapsedMs = Date.now() - startTime;
      return {
        success: true,
        message: 'Ingestion service started successfully',
        connectedSymbols: this.connectedSymbols,
        failedSymbols: routingResult.failedSymbols,
        timestamp: new Date(),
        metadata: {
          connectionId: `${Date.now()}`,
          webSocketUrl: this.tradeStreamPort.getStatus().connectionUrl,
          elapsedMs,
        },
      };
    } catch (error) {
      logger.error('Failed to start trade ingestion service', error);
      await this.stopIngestion();

      return {
        success: false,
        message: `Failed to start ingestion service: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        connectedSymbols: [],
        failedSymbols: [],
        timestamp: new Date(),
      };
    }
  }

  /**
   * Stop the data ingestion pipeline (Driving Port Implementation)
   */
  async stopIngestion(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Trade ingestion service not running');
      return;
    }

    try {
      logger.info('Stopping trade ingestion service...');
      await this.tradeStreamPort.disconnect();
      this.connectedSymbols = [];
      this.isRunning = false;
      logger.info('Trade ingestion service stopped successfully');
    } catch (error) {
      logger.error('Error stopping trade ingestion service', error);
    }
  }

  /**
   * Dynamic symbol management (Port Interface Implementation)
   */
  async addSymbols(symbols: string[]): Promise<{
    success: boolean;
    added: string[];
    failed: string[];
    message?: string;
  }> {
    try {
      const newSymbols = symbols.filter(
        (s) => !this.connectedSymbols.includes(s)
      );

      if (newSymbols.length === 0) {
        return {
          success: true,
          added: [],
          failed: symbols,
          message: 'All symbols already connected',
        };
      }

      const request: AddSymbolsToIngestionRequest = {
        symbols: newSymbols,
        initializeFootprint: true,
      };

      const result = await this.addSymbolsUseCase.execute(request);
      if (!result.success) {
        throw new Error(
          `Failed to add symbols: ${
            result.errors?.join(', ') || 'Unknown error'
          }`
        );
      }

      this.connectedSymbols.push(...result.addedSymbols);
      logger.info(`Successfully added ${result.addedSymbols.length} symbols`);

      return {
        success: true,
        added: result.addedSymbols,
        failed: [],
        message: `Added ${result.addedSymbols.length} symbols`,
      };
    } catch (error) {
      const failedSymbols = symbols.filter(
        (s) => !this.connectedSymbols.includes(s)
      );
      return {
        success: false,
        added: [],
        failed: failedSymbols,
        message: `Failed to add symbols: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }

  async removeSymbols(symbols: string[]): Promise<{
    success: boolean;
    removed: string[];
    failed: string[];
    message?: string;
  }> {
    try {
      const existingSymbols = symbols.filter((s) =>
        this.connectedSymbols.includes(s)
      );

      if (existingSymbols.length === 0) {
        return {
          success: true,
          removed: [],
          failed: symbols,
          message: 'None of the specified symbols were connected',
        };
      }

      const request: RemoveSymbolsFromIngestionRequest = {
        symbols: existingSymbols,
      };

      const result = await this.removeSymbolsUseCase.execute(request);
      if (!result.success && result.removedSymbols.length === 0) {
        throw new Error(
          `Failed to remove symbols: ${
            result.errors?.join(', ') || 'Unknown error'
          }`
        );
      }

      this.connectedSymbols = this.connectedSymbols.filter(
        (s) => !result.removedSymbols.includes(s)
      );
      logger.info(
        `Successfully removed ${result.removedSymbols.length} symbols`
      );

      return {
        success: true,
        removed: result.removedSymbols,
        failed: [],
        message: `Removed ${result.removedSymbols.length} symbols`,
      };
    } catch (error) {
      return {
        success: false,
        removed: [],
        failed: symbols,
        message: `Failed to remove symbols: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }

  /**
   * Status and monitoring (Port Interface Implementation)
   */
  async getStatus(): Promise<IngestionStatus> {
    const webSocketStatus = this.tradeStreamPort.getStatus();

    return {
      isRunning: this.isRunning,
      connectedSymbols: this.connectedSymbols,
      webSocketStatus: {
        isConnected: webSocketStatus.isConnected,
        url: webSocketStatus.connectionUrl || '',
        lastHeartbeat: webSocketStatus.lastHeartbeat,
        reconnectCount: webSocketStatus.reconnectCount,
      },
      footprintInitialized: this.connectedSymbols,
      timestamp: new Date(),
      uptime: process.uptime(),
    };
  }

  /**
   * Utility methods (Port Interface Implementation)
   */
  async isHealthy(): Promise<boolean> {
    return this.isRunning && this.tradeStreamPort.isHealthy();
  }

  // ============ PRIVATE METHODS ============

  /**
   * Fetch active trading symbols from database
   * Uses SymbolManagement repository - single source of truth
   */
  private async fetchActiveSymbols(): Promise<string[]> {
    try {
      const symbols = await this.symbolRepository.findActiveSymbols();
      logger.info(
        `Fetched ${symbols.length} active symbols from database (admin-approved)`
      );
      return symbols.map((symbol) => symbol.symbol);
    } catch (error) {
      logger.error('Failed to fetch active symbols from database', error);
      throw error;
    }
  }

  /**
   * Process incoming trades through footprint calculation pipeline
   */
  private async processTrades(trades: Trades): Promise<void> {
    try {
      if (trades.length === 0) return;

      const tradesBySymbol = trades.reduce((acc, trade) => {
        const symbol = trade?.s || 'UNKNOWN';
        if (!acc[symbol]) {
          acc[symbol] = [];
        }
        acc[symbol].push(trade);
        return acc;
      }, {} as Record<string, Trades>);

      const batchPromises = Object.entries(tradesBySymbol).map(
        ([symbol, symbolTrades]: [string, Trades]) =>
          this.processSymbolBatch(symbol, symbolTrades)
      );

      await Promise.all(batchPromises);
    } catch (error) {
      logger.error('Critical error in trade processing', error);
    }
  }

  /**
   * Process trades for a single symbol by routing to worker
   */
  private async processSymbolBatch(
    symbol: string,
    trades: Trades
  ): Promise<void> {
    try {
      await this.tradeRouterPort.routeTrades(symbol, trades, {
        priority: 'normal',
      });
    } catch (error) {
      logger.error(`Failed to route trades for ${symbol}`, error);
    }
  }
}
