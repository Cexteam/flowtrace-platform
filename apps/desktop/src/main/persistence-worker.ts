/**
 * FlowTrace Desktop - Persistence Worker Process
 *
 * This worker runs as a separate child process forked by the main desktop app.
 * It handles all candle persistence operations independently from the main UI thread.
 *
 * Architecture:
 * - Runs in separate Node.js process (forked via child_process)
 * - Consumes candle events via Unix Socket (primary) and SQLite Queue (fallback)
 * - Persists candles to SQLite database (database mode) or FlatBuffer binary files
 * - Provides health check endpoint for monitoring
 * - Handles graceful shutdown on SIGTERM
 *
 * Environment Variables (set by main.ts via getPersistenceEnv):
 * - FLOWTRACE_SOCKET_PATH: Unix socket path for IPC
 * - FLOWTRACE_RUNTIME_DB_PATH: Runtime database path
 * - FLOWTRACE_STORAGE_DIR: Candle storage directory
 * - FLOWTRACE_USE_DATABASE: Use SQLite database storage (default: true)
 * - FLOWTRACE_HEALTH_PORT: Health check server port (default: 3002)
 *
 * Validates: Requirements 8.1, 8.2, 8.3 (Desktop Persistence Integration)
 */

import 'reflect-metadata';
import { bootstrap } from '@flowtrace/persistence';
import { resolvePersistenceConfig } from '../config/paths.js';

/**
 * Main entry point for persistence worker
 */
async function main(): Promise<void> {
  try {
    console.log('[PersistenceWorker] Starting persistence worker process...');
    console.log('[PersistenceWorker] Process ID:', process.pid);
    console.log('[PersistenceWorker] Platform:', process.platform);

    // Get config from environment variables (set by main.ts)
    const config = resolvePersistenceConfig();

    console.log('[PersistenceWorker] Configuration:', {
      socketPath: config.socketPath,
      runtimeDbPath: config.runtimeDbPath,
      storageBaseDir: config.storageBaseDir,
      useDatabase: config.useDatabase,
      fileStorageLocation: config.fileStorageLocation,
      cloudConfig: config.cloudConfig
        ? {
            bucket: config.cloudConfig.bucketName,
            prefix: config.cloudConfig.prefix,
          }
        : undefined,
      healthCheckPort: config.healthCheckPort,
    });

    // Bootstrap persistence service with desktop configuration
    const persistenceApp = await bootstrap({
      socketPath: config.socketPath,
      runtimeDbPath: config.runtimeDbPath,
      storage: {
        baseDir: config.storageBaseDir,
        useDatabase: config.useDatabase,
        fileStorageLocation: config.fileStorageLocation,
        cloud: config.cloudConfig,
        organizeByExchange: true,
        maxCandlesPerBlock: 1000,
        walMode: true,
      },
      healthCheckPort: config.healthCheckPort,
      pollInterval: 1000,
      batchSize: 50,
    });

    console.log(
      '[PersistenceWorker] Bootstrap complete, starting application...'
    );

    // Start the persistence application
    await persistenceApp.start();

    console.log('[PersistenceWorker] Persistence service started successfully');
    console.log(
      `[PersistenceWorker] Health check available at http://localhost:${config.healthCheckPort}/health`
    );

    // Setup graceful shutdown handlers
    setupShutdownHandlers(persistenceApp);

    console.log('[PersistenceWorker] Worker ready and listening for events');
  } catch (error) {
    console.error(
      '[PersistenceWorker] Failed to start persistence worker:',
      error
    );
    process.exit(1);
  }
}

/**
 * Setup graceful shutdown handlers
 *
 * Handles SIGTERM (from parent process) and SIGINT (Ctrl+C) for clean shutdown.
 * Ensures all in-flight operations complete before exiting.
 */
function setupShutdownHandlers(persistenceApp: any): void {
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      console.log('[PersistenceWorker] Shutdown already in progress...');
      return;
    }

    isShuttingDown = true;
    console.log(
      `[PersistenceWorker] Received ${signal}, initiating graceful shutdown...`
    );

    try {
      await persistenceApp.stop();
      console.log('[PersistenceWorker] Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('[PersistenceWorker] Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', async (error) => {
    console.error('[PersistenceWorker] Uncaught exception:', error);
    await shutdown('uncaughtException');
  });

  process.on('unhandledRejection', async (reason, promise) => {
    console.error('[PersistenceWorker] Unhandled promise rejection:', {
      reason,
      promise,
    });
    await shutdown('unhandledRejection');
  });
}

// Start the worker
main().catch((error) => {
  console.error('[PersistenceWorker] Fatal error:', error);
  process.exit(1);
});
