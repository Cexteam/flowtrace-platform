/**
 * Database Configuration Resolver
 *
 * Provides utility functions for resolving database configuration from environment.
 * Uses SQLite for all deployments (unified architecture).
 *
 */

/**
 * Get default SQLite database path
 */
export function getDefaultSqlitePath(): string {
  if (process.env.SQLITE_PATH) {
    return process.env.SQLITE_PATH;
  }

  // Use platform-appropriate default path
  const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
  return `${homeDir}/.flowtrace/data.db`;
}

/**
 * Get default IPC socket path
 */
export function getDefaultSocketPath(): string {
  if (process.env.IPC_SOCKET_PATH) {
    return process.env.IPC_SOCKET_PATH;
  }

  return '/tmp/flowtrace.sock';
}
