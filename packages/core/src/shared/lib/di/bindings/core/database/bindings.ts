/**
 * Database Connection Bindings
 *
 * Configures database connection bindings using SQLite for all deployments.
 *
 */

import { Container } from 'inversify';
import { DATABASE_SYMBOLS } from './types.js';
import { DrizzleSqliteDatabase } from '../../../../../infrastructure/database/drizzle/DrizzleSqliteDatabase.js';
import { getDefaultSqlitePath } from '../../../../../infrastructure/database/config/resolver.js';

/**
 * Configure database connection bindings
 *
 * Uses SQLite for all deployments with IPC-based persistence via @flowtrace/persistence.
 *
 * @param container - InversifyJS container
 */
export function configureDatabaseBindings(container: Container): void {
  // SQLite configuration for all deployments
  // WAL mode disabled - core database has low write frequency (symbol sync hourly)
  // This simplifies deployment (1 file instead of 3)
  const sqliteConfig = {
    type: 'sqlite' as const,
    config: {
      filename: getDefaultSqlitePath(),
      walMode: false,
    },
  };

  container.bind(DATABASE_SYMBOLS.DatabaseConfig).toConstantValue(sqliteConfig);

  // Drizzle SQLite database
  container
    .bind(DATABASE_SYMBOLS.DrizzleDatabase)
    .to(DrizzleSqliteDatabase)
    .inSingletonScope();
}
