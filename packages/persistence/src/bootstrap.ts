import { PersistenceApplication } from './application/PersistenceApplication.js';
import { ContainerFactory } from './lib/di/container.js';
import { APPLICATION_TYPES } from './application/di/module.js';

/**
 * Configuration for bootstrapping the persistence service
 */
export interface PersistenceBootstrapConfig {
  /** Unix socket path for IPC communication */
  socketPath: string;

  /** Path to the runtime SQLite database */
  runtimeDbPath: string;

  /** Storage configuration */
  storage: {
    /** Base directory for candle storage files */
    baseDir: string;

    /** Use SQLite database storage (true) or binary file storage (false). Default: true */
    useDatabase?: boolean;

    /** Organize databases by exchange for better scalability. Default: false */
    organizeByExchange?: boolean;

    /** Maximum candles per block/batch operation. Default: 1000 */
    maxCandlesPerBlock?: number;

    /** Enable WAL mode for better concurrent access. Default: true */
    walMode?: boolean;

    /** SQLite cache size in KB. Default: 65536 (64MB) */
    cacheSize?: number;

    /** Memory-mapped I/O size in bytes. Default: 268435456 (256MB) */
    mmapSize?: number;
  };

  /** HTTP port for health check server. Default: 3001 */
  healthCheckPort?: number;

  /** Polling interval for RuntimeDatabasePoller in ms. Default: 1000 */
  pollInterval?: number;

  /** Batch size for message processing. Default: 50 */
  batchSize?: number;
}

/**
 * Bootstrap the persistence service
 * Creates a fully configured DI container and returns the PersistenceApplication.
 * @example
 * const app = await bootstrap({
 *   socketPath: '/tmp/flowtrace.sock',
 *   runtimeDbPath: '/data/runtime.db',
 *   storage: { baseDir: '/data/candles' }
 * });
 * await app.start();
 */
export async function bootstrap(
  config: PersistenceBootstrapConfig
): Promise<PersistenceApplication> {
  const container = ContainerFactory.create(config);

  return container.get<PersistenceApplication>(
    APPLICATION_TYPES.PersistenceApplication
  );
}
