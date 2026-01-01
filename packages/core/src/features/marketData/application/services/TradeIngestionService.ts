import { injectable, inject } from 'inversify';
// Use types-only import to avoid circular dependency with ContainerFactory
import {
  TYPES,
  WORKER_MANAGEMENT_TYPES,
} from '../../../../shared/lib/di/core/types.js';
import { TradeRouterDrivingPort } from '../../../tradeRouter/application/ports/in/TradeRouterDrivingPort.js';
import { WorkerCommunicationPort } from '../../../workerManagement/application/ports/in/WorkerCommunicationPort.js';
import {
  WorkerPoolPort,
  WorkerPoolConfig,
} from '../../../workerManagement/application/ports/in/WorkerPoolPort.js';
import { ConsistentHashRouter } from '../../../workerManagement/domain/services/ConsistentHashRouter.js';
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
  HealthMetrics,
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
    private tradeStreamPort: TradeStreamPort,
    @inject(WORKER_MANAGEMENT_TYPES.WorkerPoolPort)
    private workerPoolPort: WorkerPoolPort,
    @inject(WORKER_MANAGEMENT_TYPES.WorkerCommunicationPort)
    private workerCommunicationPort: WorkerCommunicationPort,
    @inject(WORKER_MANAGEMENT_TYPES.ConsistentHashRouter)
    private consistentHashRouter: ConsistentHashRouter
  ) {
    // ✅ NO infrastructure instantiation in Application Layer!
    // Worker management is now injected via ports
  }

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

      // ✅ PHASE 0: Initialize worker pool (waits for all workers to be ready)
      // Requirements 3.1: Initialize worker pool and wait for all workers to be ready before proceeding
      await this.initializeWorkerPool();
      logger.info('All workers are ready');

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
        // Workers need socketPath to persist state when symbols are added later
        await this.sendWorkerInitMessages([]);

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

      // ✅ PHASE 2: Initialize symbol routing to workers
      // Requirements 3.2: Initialize symbol routing after workers are ready
      await this.initializeSymbolRouting(activeSymbols);
      logger.info('Symbol routing initialized');

      // ✅ PHASE 3: Register trade callback through port
      this.tradeStreamPort.setTradeCallback((trades: Trades) => {
        this.processTrades(trades);
      });

      // ✅ PHASE 4: Connect to WebSocket streams (LAST - only after routing is ready)
      // Requirements 3.3, 3.4: Connect WebSocket only after symbol routing is complete
      await this.tradeStreamPort.connect(activeSymbols);
      this.connectedSymbols = activeSymbols;

      this.isRunning = true;
      logger.info('Trade ingestion service started successfully');

      const elapsedMs = Date.now() - startTime;
      return {
        success: true,
        message: 'Ingestion service started successfully',
        connectedSymbols: this.connectedSymbols,
        failedSymbols: [],
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
   * Restart the data ingestion pipeline (Driving Port Implementation)
   */
  async restartIngestion(): Promise<IngestionResult> {
    await this.restart();
    return {
      success: this.isRunning,
      message: this.isRunning
        ? 'Service restarted successfully'
        : 'Service restart failed',
      connectedSymbols: this.connectedSymbols,
      failedSymbols: [],
      timestamp: new Date(),
    };
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

  async getHealthMetrics(): Promise<HealthMetrics> {
    const webSocketHealth = this.tradeStreamPort.isHealthy();

    return {
      timestamp: new Date(),
      uptime: process.uptime(),
      connectedSymbols: this.connectedSymbols.length,
      webSocketHealth: {
        status: webSocketHealth ? 'healthy' : 'unhealthy',
        reconnects: 0,
        lastHeartbeat: Date.now(),
        connectionHealth: webSocketHealth ? 100 : 0,
      },
      footprintHealth: {
        initializedSymbols: this.connectedSymbols.length,
        processingRate: this.isRunning ? 1.0 : 0.0,
      },
      gapDetection: {
        totalGaps: 0,
        lastGap: undefined,
      },
      performance: {
        memoryUsage: process.memoryUsage().heapUsed,
        cpuUsage: process.cpuUsage().user + process.cpuUsage().system,
      },
    };
  }

  async getConnectedSymbols(): Promise<string[]> {
    return [...this.connectedSymbols];
  }

  /**
   * Utility methods (Port Interface Implementation)
   */
  async resetTracking(): Promise<void> {
    await this.stopIngestion();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await this.startIngestion();
  }

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
      // Query database for active symbols (admin-approved)
      const symbols = await this.symbolRepository.findActiveSymbols();

      logger.info(
        `Fetched ${symbols.length} active symbols from database (admin-approved)`
      );

      // Return symbol names
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
        // Trade is individual trade object
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
      // ✅ ROUTE VIA CLEAN ARCHITECTURE: Use TradeRouterDrivingPort
      await this.tradeRouterPort.routeTrades(symbol, trades, {
        priority: 'normal',
      });
    } catch (error) {
      logger.error(`Failed to route trades for ${symbol}`, error);
    }
  }

  /**
   * Initialize symbol routing to workers for trade processing
   * (Workers own and handle footprint calculations internally)
   */
  private async initializeSymbolRouting(symbols: string[]): Promise<void> {
    // Step 1: Assign symbols to workers via routing
    const results = await Promise.allSettled(
      symbols.map((symbol) => this.tradeRouterPort.assignSymbolToWorker(symbol))
    );

    const failedSymbols = results
      .map((result, index) =>
        result.status === 'rejected' ? symbols[index] : null
      )
      .filter((symbol) => symbol !== null);

    if (failedSymbols.length > 0) {
      logger.warn(
        `Symbol initialization failed for ${failedSymbols.length} symbols (invalid format)`
      );
    }

    logger.info(
      `Symbol routing initialized: ${symbols.length - failedSymbols.length}/${
        symbols.length
      } symbols assigned to workers`
    );

    // Step 2: Send WORKER_INIT to each worker with their assigned symbols
    // This triggers state loading and starts periodic flush
    // Pass symbols directly since this.connectedSymbols is not set yet
    await this.sendWorkerInitMessages(symbols);
  }

  /**
   * Send WORKER_INIT message to each worker with their assigned symbols
   * This triggers:
   * - State loading from persistence (restore candle states)
   * - Start periodic flush (save dirty states every 30s)
   *
   * Uses ConsistentHashRouter to pre-compute symbol assignments based on
   * the same algorithm used for trade routing. This ensures symbols are
   * loaded into the correct worker that will process their trades.
   *
   * @param symbols - List of symbols to assign to workers
   */
  private async sendWorkerInitMessages(symbols: string[]): Promise<void> {
    const socketPath = env.IPC_SOCKET_PATH || '/tmp/flowtrace-persistence.sock';

    try {
      // Get all worker IDs from the pool
      const workerIds = this.workerPoolPort.getWorkerIds();
      if (workerIds.length === 0) {
        logger.warn('No workers available for WORKER_INIT');
        return;
      }

      // Pre-compute symbol assignments using ConsistentHashRouter
      // This ensures symbols are assigned to the same worker that will process their trades
      const workerSymbolMap = new Map<string, string[]>();
      for (const workerId of workerIds) {
        workerSymbolMap.set(workerId, []);
      }

      // Assign each symbol to its worker based on consistent hash
      // Use the symbols parameter (not this.connectedSymbols which may not be set yet)
      for (const symbol of symbols) {
        try {
          const routingResult =
            this.consistentHashRouter.getWorkerForSymbol(symbol);
          const workerSymbols = workerSymbolMap.get(routingResult.workerId);
          if (workerSymbols) {
            workerSymbols.push(symbol);
          }
        } catch (error) {
          logger.warn(
            `Failed to route symbol ${symbol}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      }

      logger.info(`Sending WORKER_INIT to ${workerIds.length} workers...`);

      // Send WORKER_INIT to each worker with their pre-computed assigned symbols
      const initPromises = workerIds.map(async (workerId) => {
        const assignedSymbols = workerSymbolMap.get(workerId) || [];
        try {
          await this.workerCommunicationPort.initializeWorker(workerId, {
            socketPath,
            assignedSymbols,
          });
          logger.info(
            `Worker ${workerId} initialized with ${
              assignedSymbols.length
            } symbols: [${assignedSymbols.slice(0, 3).join(', ')}${
              assignedSymbols.length > 3 ? '...' : ''
            }]`
          );
        } catch (error) {
          logger.error(
            `Failed to initialize worker ${workerId}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      });

      await Promise.all(initPromises);
      logger.info('All workers initialized with assigned symbols');
    } catch (error) {
      logger.error('Failed to send WORKER_INIT messages', error);
      // Don't throw - workers can still process trades, just won't have state persistence
    }
  }

  /**
   * Initialize worker pool - creates worker threads and sets up communication
   * Uses WorkerPoolPort for clean architecture compliance
   */
  private async initializeWorkerPool(): Promise<void> {
    const numWorkers = env.WORKER_THREADS_COUNT || 2;
    const socketPath = env.IPC_SOCKET_PATH || '/tmp/flowtrace-persistence.sock';

    logger.info(
      `🚀 Initializing ${numWorkers} worker threads via WorkerPoolPort (socketPath: ${socketPath})...`
    );

    try {
      // ✅ Use WorkerPoolPort to initialize worker pool
      // Note: workerScript is NOT set - adapter uses getDefaultWorkerScriptPath()
      // which resolves correctly using __dirname for both server and desktop
      const config: WorkerPoolConfig = {
        workerCount: numWorkers,
        // workerScript not needed - adapter uses getDefaultWorkerScriptPath() automatically
        socketPath, // Pass socketPath for IPC-based persistence
      };

      await this.workerPoolPort.initialize(config);

      const status = this.workerPoolPort.getStatus();
      logger.info(
        `🚀 Worker pool initialization complete: ${status.healthyWorkers}/${status.totalWorkers} workers healthy`
      );
    } catch (error) {
      logger.error('❌ Failed to initialize worker pool', error);
      throw error; // Fail fast if worker initialization fails
    }
  }

  /**
   * Restart the service (private implementation)
   */
  private async restart(): Promise<IngestionResult> {
    await this.stopIngestion();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await this.startIngestion();
  }
}
