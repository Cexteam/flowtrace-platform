/**
 * Database Configuration Types
 *
 * Configuration interfaces for SQLite database connections.
 *
 */

/**
 * SQLite connection configuration
 */
export interface SqliteConfig {
  /** Path to the SQLite database file */
  filename: string;

  /** Open in read-only mode */
  readonly?: boolean;

  /** Create file if it doesn't exist */
  fileMustExist?: boolean;

  /** Enable WAL mode for better concurrency */
  walMode?: boolean;
}

/**
 * Database configuration type (SQLite only)
 */
export type DatabaseConfig = {
  type: 'sqlite';
  config: SqliteConfig;
};
