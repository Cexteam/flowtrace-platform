/**
 * Candle Persistence Feature - Public API
 *
 * This module exports the factory function for creating read-only candle readers.
 * It provides a simple, DI-free way to access candle data from external packages.
 *
 * @module @flowtrace/persistence/features/candlePersistence
 */

import * as fs from 'fs';
import { ReadOnlyCandleStorage } from './infrastructure/adapters/ReadOnlyCandleStorage.js';
import type { CandleReaderPort } from './application/ports/out/CandleReaderPort.js';

/**
 * Configuration for creating a candle reader
 */
export interface CandleReaderConfig {
  /** Path to SQLite database file */
  dbPath: string;
  /** Optional: Cache size in KB (default: 32MB) */
  cacheSize?: number;
}

/**
 * Creates a read-only candle reader instance.
 *
 * This factory function provides a simple way to create a CandleReaderPort
 * without requiring Inversify DI container initialization.
 *
 * @param config - Configuration for the candle reader
 * @returns CandleReaderPort instance for reading candle data
 * @throws Error if dbPath does not exist or is not readable
 *
 * @example
 * ```typescript
 * import { createCandleReader } from '@flowtrace/persistence';
 *
 * const reader = createCandleReader({ dbPath: '/data/candles.db' });
 * const candles = await reader.findBySymbol('BTCUSDT', 'binance', '1m');
 * await reader.close();
 * ```
 */
export function createCandleReader(
  config: CandleReaderConfig
): CandleReaderPort {
  // Validate dbPath exists
  if (!config.dbPath) {
    throw new Error('Database path is required');
  }

  // Check if file exists
  if (!fs.existsSync(config.dbPath)) {
    throw new Error(`Database file not found: ${config.dbPath}`);
  }

  // Check if file is readable
  try {
    fs.accessSync(config.dbPath, fs.constants.R_OK);
  } catch {
    throw new Error(
      `Cannot open database: ${config.dbPath} - Permission denied`
    );
  }

  // Create and return the read-only storage adapter
  return new ReadOnlyCandleStorage({
    dbPath: config.dbPath,
    cacheSize: config.cacheSize,
  });
}
