/**
 * FlowTrace Desktop - Main Entry Point (Wrapper Only)
 *
 * Desktop app is a thin wrapper around @flowtrace/core and @flowtrace/api.
 * All business logic is in core - this file only handles:
 * - Electron-specific setup (BrowserWindow, protocol, IPC)
 * - Starting FlowTraceApplication from core
 * - Creating NestJS application context for shared services
 *
 * Uses unified SQLite-based architecture (same as server deployment).
 */

// ESM-compatible __dirname and __filename
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Step 1: Load desktop .env file FIRST before any other imports
import { config } from 'dotenv';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const desktopEnvPath = resolve(__dirname, '../.env');
if (existsSync(desktopEnvPath)) {
  config({ path: desktopEnvPath });
}

import { app as electronApp, protocol } from 'electron';
import * as pathModule from 'path';

// Step 2: Import PathResolver and compute all paths once
import {
  resolvePaths,
  setCoreEnvVars,
  getPersistenceEnv,
  type DesktopPaths,
} from './config/paths.js';

// Compute all paths based on Electron context
const paths: DesktopPaths = resolvePaths({
  isPackaged: electronApp.isPackaged,
  userDataPath: electronApp.getPath('userData'),
  devDataDir: resolve(__dirname, '../data'),
});

// Step 2.5: Ensure all required directories exist
// better-sqlite3 doesn't create parent directories automatically
[
  paths.dataDir,
  paths.logDir,
  paths.persistenceDir,
  paths.candleStorageDir,
].forEach((dir) => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

// Step 3: Set env vars for @flowtrace/core BEFORE importing it
setCoreEnvVars(paths);

// Also set FLOWTRACE_LOG_DIR for backward compatibility
process.env.FLOWTRACE_LOG_DIR = paths.logDir;

// Now safe to import @flowtrace/core and other modules
import 'reflect-metadata';
import { BrowserWindow, net } from 'electron';

import {
  createLogger,
  bootstrap,
  type BootstrapResult,
  TYPES,
} from '@flowtrace/core';
import {
  bootstrap as bootstrapApi,
  type BootstrapResult as ApiBootstrapResult,
} from '@flowtrace/api';
import {
  createCandleReader,
  createIPCGapReader,
  type CandleReaderPort,
  type GapReaderPort,
} from '@flowtrace/persistence';
import {
  registerIpcHandlers,
  unregisterIpcHandlers,
} from './ipc/registerHandlers.js';
import { PersistenceServiceManager } from './main/services/PersistenceServiceManager.js';

const logger = createLogger('Desktop');

/**
 * FlowTrace Desktop Application - Thin Wrapper
 */
class FlowTraceDesktop {
  private mainWindow: BrowserWindow | null = null;
  private bootstrapResult: BootstrapResult | null = null;
  private apiBootstrapResult: ApiBootstrapResult | null = null;
  private persistenceManager: PersistenceServiceManager | null = null;
  private isQuitting = false;
  private readonly paths: DesktopPaths;

  constructor(desktopPaths: DesktopPaths) {
    this.paths = desktopPaths;
    this.setupAppHandlers();
  }

  /**
   * Initialize the desktop application
   *
   * Simple flow:
   * 1. Register custom protocol
   * 2. Start persistence service FIRST (workers need it)
   * 3. Bootstrap core - creates DI container and starts FlowTraceApplication
   * 4. Create CandleReader and GapReader
   * 5. Bootstrap API in context mode
   * 6. Register IPC handlers
   * 7. Create window
   */
  async initialize(): Promise<void> {
    try {
      // Log all resolved paths for debugging
      logger.info('Initializing FlowTrace Desktop...', {
        electronVersion: process.versions.electron,
        nodeVersion: process.version,
        platform: process.platform,
        isPackaged: electronApp.isPackaged,
        paths: this.paths,
      });

      // Step 1: Register custom protocol for static files
      this.registerCustomProtocol();

      // Step 2: Start persistence service FIRST (workers need Unix Socket)
      logger.info('Starting persistence service manager...');
      await this.startPersistenceService();

      // Step 3: Bootstrap core - creates container and starts FlowTraceApplication
      // Workers will connect to persistence service via Unix Socket
      logger.info('Bootstrapping FlowTrace core...');
      this.bootstrapResult = await bootstrap();
      logger.info('FlowTrace core bootstrapped successfully');

      // Verify core services are correctly resolved
      this.verifyCoreServices();

      // Step 4: Create CandleReader and GapReader
      // CandleReader is lazy - will auto-create when database exists
      const candleReader = this.createLazyCandleReader();
      const gapReader = this.createGapReader();

      // Step 5: Bootstrap API in context mode (NO HTTP server)
      logger.info('Bootstrapping API in context mode...');
      this.apiBootstrapResult = await bootstrapApi(
        this.bootstrapResult.container,
        { mode: 'context', candleReader, gapReader }
      );
      logger.info('API bootstrapped successfully in context mode');

      // Step 6: Register IPC handlers with NestJS app context
      logger.info('Registering IPC handlers...');
      registerIpcHandlers(this.apiBootstrapResult.app);

      // Step 7: Create main window
      logger.info('Creating main window...');
      await this.createMainWindow();

      logger.info('FlowTrace Desktop initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize FlowTrace Desktop', error);
      electronApp.quit();
    }
  }

  /**
   * Create a lazy multi-exchange CandleReader
   *
   * This wrapper handles:
   * 1. Lazy initialization - creates reader when database exists
   * 2. Multi-exchange support - routes queries to correct exchange database
   * 3. Caching - reuses readers for same exchange
   */
  private createLazyCandleReader(): CandleReaderPort {
    const candleStorageDir = this.paths.candleStorageDir;

    // Cache readers per exchange
    const readerCache = new Map<string, CandleReaderPort>();

    const getReaderForExchange = (
      exchange: string
    ): CandleReaderPort | null => {
      // Check cache first
      if (readerCache.has(exchange)) {
        return readerCache.get(exchange)!;
      }

      // Build path for this exchange's database
      const dbPath = pathModule.join(candleStorageDir, exchange, 'candles.db');

      if (!existsSync(dbPath)) {
        logger.debug(`Database not found for exchange ${exchange}`, { dbPath });
        return null;
      }

      try {
        const reader = createCandleReader({ dbPath });
        readerCache.set(exchange, reader);
        logger.info(`CandleReader created for exchange: ${exchange}`, {
          dbPath,
        });
        return reader;
      } catch (error) {
        logger.warn(`Failed to create CandleReader for ${exchange}`, {
          dbPath,
          error,
        });
        return null;
      }
    };

    // Return a proxy that routes to correct exchange reader
    return {
      async findBySymbol(
        symbol: string,
        exchange: string,
        timeframe: string,
        options?: { startTime?: number; endTime?: number; limit?: number }
      ) {
        const reader = getReaderForExchange(exchange);
        if (!reader) return [];
        return reader.findBySymbol(symbol, exchange, timeframe, options);
      },

      async findLatest(symbol: string, exchange: string, timeframe: string) {
        const reader = getReaderForExchange(exchange);
        if (!reader) return null;
        return reader.findLatest(symbol, exchange, timeframe);
      },

      async count(
        symbol: string,
        exchange: string,
        timeframe: string,
        options?: { startTime?: number; endTime?: number }
      ) {
        const reader = getReaderForExchange(exchange);
        if (!reader) return 0;
        return reader.count(symbol, exchange, timeframe, options);
      },

      async close() {
        // Close all cached readers
        for (const [exchange, reader] of readerCache) {
          try {
            await reader.close();
            logger.debug(`Closed CandleReader for ${exchange}`);
          } catch (error) {
            logger.warn(`Failed to close CandleReader for ${exchange}`, {
              error,
            });
          }
        }
        readerCache.clear();
      },
    };
  }

  /**
   * Create CandleReader for FootprintService (legacy - kept for reference)
   *
   * Creates a read-only candle reader from persistence package.
   * Returns null if database doesn't exist yet (first run).
   */
  private createCandleReader(): CandleReaderPort | null {
    // Default to binance exchange database
    const dbPath = pathModule.join(
      this.paths.candleStorageDir,
      'binance',
      'candles.db'
    );

    if (!existsSync(dbPath)) {
      logger.info(
        'Candle database not found, FootprintService will return empty results',
        {
          dbPath,
        }
      );
      return null;
    }

    try {
      const reader = createCandleReader({ dbPath });
      logger.info('CandleReader created successfully', { dbPath });
      return reader;
    } catch (error) {
      logger.warn(
        'Failed to create CandleReader, FootprintService will return empty results',
        {
          dbPath,
          error,
        }
      );
      return null;
    }
  }

  /**
   * Create GapReader for DataQualityService
   *
   * Creates an IPC-based gap reader that reads from persistence worker.
   * This avoids database lock issues since persistence worker owns the database.
   */
  private createGapReader(): GapReaderPort | null {
    try {
      const reader = createIPCGapReader({
        socketPath: this.paths.socketPath,
        timeout: 10000,
      });

      logger.info('GapReader created successfully (IPC mode)', {
        socketPath: this.paths.socketPath,
      });
      return reader;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.warn(
        'Failed to create GapReader, DataQualityService will return empty results',
        { socketPath: this.paths.socketPath, error: errorMessage }
      );
      return null;
    }
  }

  /**
   * Start the persistence service manager
   *
   * Creates and starts the PersistenceServiceManager which forks the persistence
   * worker process. The worker handles all candle persistence operations using
   * SQLite database mode.
   */
  private async startPersistenceService(): Promise<void> {
    try {
      // Determine the path to the persistence worker script
      const workerPath = electronApp.isPackaged
        ? pathModule.join(
            process.resourcesPath,
            'app.asar',
            'dist',
            'main',
            'persistence-worker.js'
          )
        : pathModule.join(__dirname, 'main', 'persistence-worker.js');

      // Get persistence env vars using PathResolver helper
      // Set useDatabase: false to use hierarchical file storage instead of SQLite
      const useDatabase = process.env.FLOWTRACE_USE_DATABASE !== 'false';
      const persistenceEnv = getPersistenceEnv(this.paths, {
        useDatabase,
        healthPort: 3002,
      });

      logger.info('Initializing persistence service manager', {
        workerPath,
        persistenceEnv,
      });

      // Create the persistence service manager with computed env
      this.persistenceManager = new PersistenceServiceManager({
        workerPath,
        maxRestartAttempts: 5,
        rateLimitWindow: 60000, // 1 minute
        restartDelay: 1000, // 1 second
        autoRestart: true,
        env: persistenceEnv,
      });

      // Start the persistence worker
      await this.persistenceManager.start();

      logger.info('Persistence service manager started successfully');

      // Log status
      const status = this.persistenceManager.getStatus();
      logger.info('Persistence service status', status);
    } catch (error) {
      logger.error('Failed to start persistence service manager', error);
      // Don't throw - allow app to continue without persistence service
    }
  }

  /**
   * Verify core services are correctly resolved
   */
  private verifyCoreServices(): void {
    if (!this.bootstrapResult) {
      throw new Error('Bootstrap result is not available');
    }

    const { container } = this.bootstrapResult;

    logger.info('Verifying core services...');

    if (!container.isBound(TYPES.Logger)) {
      throw new Error('Logger service not bound in container');
    }

    if (!container.isBound(TYPES.FlowTraceApplication)) {
      throw new Error('FlowTraceApplication not bound in container');
    }

    logger.info('Core services verified successfully');
  }

  /**
   * Register custom protocol for serving static files
   */
  private registerCustomProtocol(): void {
    protocol.handle('app', (request) => {
      const url = new URL(request.url);
      let filePath = url.pathname;

      const uiDir = electronApp.isPackaged
        ? pathModule.join(process.resourcesPath, 'ui')
        : pathModule.join(__dirname, '..', 'ui');

      if (filePath === '/' || filePath === '') {
        filePath = '/index.html';
      }

      const fullPath = pathModule.join(uiDir, filePath);
      return net.fetch(`file://${fullPath}`);
    });

    logger.info('Custom protocol "app://" registered');
  }

  /**
   * Create the main application window
   */
  private async createMainWindow(): Promise<void> {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1024,
      minHeight: 768,
      title: 'FlowTrace',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: pathModule.join(__dirname, 'preload.js'),
      },
      show: false,
    });

    const isDev = process.env['NODE_ENV'] === 'development';

    if (isDev) {
      const devUrl = process.env['DEV_URL'] || 'http://localhost:3000';
      await this.mainWindow.loadURL(devUrl);
      this.mainWindow.webContents.openDevTools();
    } else {
      await this.mainWindow.loadURL('app://./index.html');
    }

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    // Fallback timeout
    setTimeout(() => {
      if (this.mainWindow && !this.mainWindow.isVisible()) {
        this.mainWindow.show();
      }
    }, 3000);

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isQuitting) return;
    this.isQuitting = true;

    logger.info('Shutting down FlowTrace Desktop...');

    // Unregister IPC handlers
    unregisterIpcHandlers();

    // Stop persistence service manager
    if (this.persistenceManager) {
      logger.info('Stopping persistence service manager...');
      try {
        await this.persistenceManager.stop();
        logger.info('Persistence service manager stopped');
      } catch (error) {
        logger.error('Error stopping persistence service manager', error);
      }
    }

    // Close NestJS application context
    if (this.apiBootstrapResult) {
      await this.apiBootstrapResult.close();
    }

    // Stop FlowTraceApplication - handles all cleanup
    if (this.bootstrapResult?.app) {
      await this.bootstrapResult.app.stop();
    }

    logger.info('FlowTrace Desktop shutdown complete');
  }

  /**
   * Setup Electron app event handlers
   */
  private setupAppHandlers(): void {
    // Register custom protocol scheme as privileged
    protocol.registerSchemesAsPrivileged([
      {
        scheme: 'app',
        privileges: {
          standard: true,
          secure: true,
          supportFetchAPI: true,
          corsEnabled: true,
        },
      },
    ]);

    electronApp.whenReady().then(() => {
      this.initialize();

      electronApp.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    electronApp.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        electronApp.quit();
      }
    });

    electronApp.on('before-quit', async (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        await this.shutdown();
        electronApp.quit();
      }
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT (Ctrl+C), initiating graceful shutdown...');
      await this.shutdown();
      electronApp.quit();
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, initiating graceful shutdown...');
      await this.shutdown();
      electronApp.quit();
    });

    process.on('uncaughtException', async (error) => {
      logger.error(
        'Uncaught exception, attempting graceful shutdown...',
        error
      );
      try {
        await this.shutdown();
      } catch (shutdownError) {
        logger.error('Error during emergency shutdown', shutdownError);
      }
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled promise rejection:', { reason, promise });
    });

    process.on('exit', (code) => {
      logger.info(`Process exiting with code ${code}`);
    });
  }
}

// Start the desktop application with computed paths
new FlowTraceDesktop(paths);
