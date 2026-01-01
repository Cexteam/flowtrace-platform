/**
 * SQLite Migrations Index
 *
 * Lists all SQLite migrations in order of execution.
 * Used by DatabaseMigrator to run migrations for Desktop platform.
 *
 *
 * Note: Users and AuthSessions are NOT included here.
 * - Auth is Cloud-only, Desktop calls Cloud API
 *
 * Note: Trades and Candles are NOT included here.
 * - Desktop uses Binary (FlatBuffer) storage for market data
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Migration metadata
 */
export interface MigrationInfo {
  /** Migration version number */
  version: number;
  /** Migration name */
  name: string;
  /** Migration filename */
  filename: string;
  /** Full path to migration file */
  filepath: string;
}

/**
 * SQLite migrations in execution order
 */
export const SQLITE_MIGRATIONS: MigrationInfo[] = [
  {
    version: 1,
    name: 'create_exchanges',
    filename: '001_create_exchanges.sql',
    filepath: path.join(__dirname, '001_create_exchanges.sql'),
  },
  {
    version: 2,
    name: 'create_symbols',
    filename: '002_create_symbols.sql',
    filepath: path.join(__dirname, '002_create_symbols.sql'),
  },
  {
    version: 3,
    name: 'create_worker_assignments',
    filename: '003_create_worker_assignments.sql',
    filepath: path.join(__dirname, '003_create_worker_assignments.sql'),
  },
];

/**
 * Get migration SQL content by version
 */
export function getMigrationSql(version: number): string {
  const migration = SQLITE_MIGRATIONS.find((m) => m.version === version);
  if (!migration) {
    throw new Error(`SQLite migration version ${version} not found`);
  }
  return fs.readFileSync(migration.filepath, 'utf-8');
}

/**
 * Get all migrations in order
 */
export function getAllMigrations(): MigrationInfo[] {
  return [...SQLITE_MIGRATIONS].sort((a, b) => a.version - b.version);
}

/**
 * Get latest migration version
 */
export function getLatestVersion(): number {
  return Math.max(...SQLITE_MIGRATIONS.map((m) => m.version));
}
