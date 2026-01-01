/**
 * PathResolver Module - Centralized path configuration for Desktop App
 *
 * This module computes all paths once based on Electron context and provides
 * helper functions to set env vars and get persistence config.
 *
 * Why Desktop App needs this:
 * 1. Paths depend on Electron APIs (isPackaged, getPath('userData'))
 * 2. Env vars must be set BEFORE importing @flowtrace/core
 * 3. Persistence worker runs in child process, needs explicit config
 */

import * as path from 'path';

/**
 * All paths needed by desktop app and its packages
 */
export interface DesktopPaths {
  // Base directories
  dataDir: string; // Main data directory
  logDir: string; // Log files directory
  persistenceDir: string; // Persistence service directory

  // Core package paths
  sqlitePath: string; // Main SQLite database (flowtrace.db)
  socketPath: string; // Unix socket for IPC

  // Persistence worker paths
  runtimeDbPath: string; // Runtime database (runtime.db)
  candleStorageDir: string; // Candle storage directory
}

/**
 * Context needed to resolve paths
 */
export interface PathResolverContext {
  isPackaged: boolean; // electronApp.isPackaged
  userDataPath: string; // electronApp.getPath('userData')
  devDataDir: string; // resolve(__dirname, '../data')
}

/**
 * Resolve all paths based on runtime context
 *
 * @param context - Electron context with isPackaged flag and base paths
 * @returns DesktopPaths with all computed paths
 * @throws Error if required paths are empty
 */
export function resolvePaths(context: PathResolverContext): DesktopPaths {
  const { isPackaged, userDataPath, devDataDir } = context;

  // Validate inputs
  if (isPackaged && !userDataPath) {
    throw new Error('PathResolver: userDataPath is required in packaged mode');
  }
  if (!isPackaged && !devDataDir) {
    throw new Error('PathResolver: devDataDir is required in development mode');
  }

  // Base directories
  const dataDir = isPackaged ? path.join(userDataPath, 'data') : devDataDir;

  const persistenceDir = isPackaged
    ? userDataPath
    : path.join(devDataDir, 'persistence');

  const logDir = isPackaged
    ? path.join(userDataPath, 'logs')
    : path.join(devDataDir, 'logs');

  return {
    dataDir,
    logDir,
    persistenceDir,

    // Core paths
    sqlitePath: path.join(dataDir, 'flowtrace.db'),
    socketPath: path.join(persistenceDir, 'flowtrace.sock'),

    // Persistence paths
    runtimeDbPath: path.join(persistenceDir, 'runtime.db'),
    candleStorageDir: path.join(persistenceDir, 'candles'),
  };
}

/**
 * Set environment variables for @flowtrace/core package
 *
 * MUST be called BEFORE importing @flowtrace/core
 *
 * @param paths - Resolved desktop paths
 */
export function setCoreEnvVars(paths: DesktopPaths): void {
  process.env.SQLITE_PATH = paths.sqlitePath;
  process.env.IPC_SOCKET_PATH = paths.socketPath;
  process.env.LOG_DIR = paths.logDir;
}

/**
 * Options for getPersistenceEnv
 */
export interface PersistenceEnvOptions {
  userDataPath?: string;
  isPackaged?: boolean;
  useDatabase?: boolean;
  healthPort?: number;
}

/**
 * Get environment variables for persistence worker (child process)
 *
 * @param paths - Resolved desktop paths
 * @param options - Optional configuration overrides
 * @returns Record of FLOWTRACE_* env vars for child process
 */
export function getPersistenceEnv(
  paths: DesktopPaths,
  options?: PersistenceEnvOptions
): Record<string, string> {
  return {
    FLOWTRACE_SOCKET_PATH: paths.socketPath,
    FLOWTRACE_RUNTIME_DB_PATH: paths.runtimeDbPath,
    FLOWTRACE_STORAGE_DIR: paths.candleStorageDir,
    FLOWTRACE_USE_DATABASE: String(options?.useDatabase ?? true),
    FLOWTRACE_HEALTH_PORT: String(options?.healthPort ?? 3002),
  };
}

/**
 * Configuration for persistence worker bootstrap
 */
export interface PersistenceWorkerConfig {
  socketPath: string;
  runtimeDbPath: string;
  storageBaseDir: string;
  useDatabase: boolean;
  healthCheckPort: number;
}

/**
 * Resolve persistence worker config from environment variables
 *
 * Called by persistence-worker.ts to get all config from env vars
 * that were set by main.ts via getPersistenceEnv()
 *
 * @throws Error if required env vars are missing
 */
export function resolvePersistenceConfig(): PersistenceWorkerConfig {
  const socketPath = process.env.FLOWTRACE_SOCKET_PATH;
  const runtimeDbPath = process.env.FLOWTRACE_RUNTIME_DB_PATH;
  const storageBaseDir = process.env.FLOWTRACE_STORAGE_DIR;

  // Validate required env vars
  if (!socketPath) {
    throw new Error('FLOWTRACE_SOCKET_PATH environment variable is required');
  }
  if (!runtimeDbPath) {
    throw new Error(
      'FLOWTRACE_RUNTIME_DB_PATH environment variable is required'
    );
  }
  if (!storageBaseDir) {
    throw new Error('FLOWTRACE_STORAGE_DIR environment variable is required');
  }

  return {
    socketPath,
    runtimeDbPath,
    storageBaseDir,
    useDatabase: process.env.FLOWTRACE_USE_DATABASE !== 'false',
    healthCheckPort: parseInt(process.env.FLOWTRACE_HEALTH_PORT || '3002', 10),
  };
}
