/**
 * StatePersistenceService
 *
 * Application service that manages CandleGroup state persistence via IPC.
 * Runs in WORKER THREAD, not main thread.
 *
 * Responsibilities:
 * - Load states for assigned symbols on worker startup
 * - Periodic flush of dirty states (30s interval, 50 symbols per batch)
 * - Graceful shutdown with full state flush
 * - Extract lastTradeId from loaded states for gap detection
 *
 * Hexagonal Architecture:
 * - Implements Port In (StatePersistenceServicePort)
 * - Uses Port Out (CandleStoragePort, StatePersistencePort)
 */

import { injectable, inject } from 'inversify';
import type { CandleStoragePort } from '../ports/out/CandleStoragePort.js';
import type { StatePersistencePort } from '../ports/out/StatePersistencePort.js';
import type { StatePersistenceServicePort } from '../ports/in/StatePersistenceServicePort.js';
import { CandleGroup } from '../../domain/entities/CandleGroup.js';
import { CANDLE_PROCESSING_TYPES } from '../../../../shared/lib/di/core/types.js';
import { createLogger } from '../../../../shared/lib/logger/logger.js';

const logger = createLogger('StatePersistenceService');

/**
 * Configuration for StatePersistenceService
 */
export interface StatePersistenceServiceConfig {
  /** Exchange identifier (default: 'binance') */
  exchange?: string;
  /** Flush interval in milliseconds (default: 30000 = 30 seconds) */
  flushIntervalMs?: number;
  /** Batch size for IPC messages (default: 50 symbols per message) */
  batchSize?: number;
}

/**
 * StatePersistenceService
 * Manages CandleGroup state persistence via IPC in worker thread
 *
 * Implements StatePersistenceServicePort (Port In)
 */
@injectable()
export class StatePersistenceService implements StatePersistenceServicePort {
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly exchange: string;
  private readonly FLUSH_INTERVAL_MS: number;
  private readonly BATCH_SIZE: number;
  private isShuttingDown: boolean = false;

  constructor(
    @inject(CANDLE_PROCESSING_TYPES.CandleStoragePort)
    private candleStorage: CandleStoragePort,

    @inject(CANDLE_PROCESSING_TYPES.StatePersistencePort)
    private statePersistence: StatePersistencePort,

    @inject('STATE_PERSISTENCE_SERVICE_CONFIG')
    config?: StatePersistenceServiceConfig
  ) {
    this.exchange = config?.exchange ?? 'binance';
    this.FLUSH_INTERVAL_MS = config?.flushIntervalMs ?? 30_000; // 30 seconds
    this.BATCH_SIZE = config?.batchSize ?? 50;
  }

  /**
   * Load states for assigned symbols from persistence and restore CandleStorage
   * Called during WORKER startup, BEFORE signaling ready to main thread
   *
   * @param assignedSymbols - Symbols assigned to this worker
   * @returns Map of symbol to lastTradeId for gap detection
   */
  async loadStatesForSymbols(
    assignedSymbols: string[]
  ): Promise<Map<string, number>> {
    if (assignedSymbols.length === 0) {
      logger.info('No symbols assigned, skipping state loading');
      return new Map();
    }

    logger.info('Loading states for assigned symbols', {
      exchange: this.exchange,
      symbolCount: assignedSymbols.length,
      symbols: assignedSymbols.slice(0, 5), // Log first 5 symbols
    });

    try {
      logger.info('Calling statePersistence.loadStatesBatch...');
      const states = await this.statePersistence.loadStatesBatch(
        this.exchange,
        assignedSymbols
      );
      logger.info('Received states from persistence', {
        receivedCount: states.length,
        requestedCount: assignedSymbols.length,
      });

      const lastTradeIds = new Map<string, number>();
      let restoredCount = 0;
      let parseErrorCount = 0;

      for (const { symbol, stateJson } of states) {
        try {
          const dto = JSON.parse(stateJson);
          // Extract tickValue from the first candle's data or use default
          const tickValue = this.extractTickValue(dto);
          const group = CandleGroup.fromJSON(dto, tickValue);

          // Restore to CandleStorage (sets dirty=false)
          this.candleStorage.restoreFromState(symbol, group);
          restoredCount++;

          // Extract lastTradeId from 1s candle for gap detection
          const oneSecCandle = group.getOneSecondCandle();
          if (oneSecCandle.ls > 0) {
            lastTradeIds.set(symbol, oneSecCandle.ls);
            logger.debug('Extracted lastTradeId for gap detection', {
              symbol,
              lastTradeId: oneSecCandle.ls,
            });
          }
        } catch (parseError) {
          parseErrorCount++;
          logger.error('Failed to parse state for symbol', {
            symbol,
            error:
              parseError instanceof Error
                ? parseError.message
                : String(parseError),
          });
          // Continue with other symbols
        }
      }

      logger.info('Loaded states for worker', {
        loadedCount: states.length,
        restoredCount,
        parseErrorCount,
        assignedCount: assignedSymbols.length,
        lastTradeIdsCount: lastTradeIds.size,
      });

      return lastTradeIds;
    } catch (error) {
      logger.error('Failed to load states from persistence', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Return empty map - worker will start with fresh state
      return new Map();
    }
  }

  /**
   * Extract tick value from CandleGroup DTO
   * Falls back to default if not found
   */
  private extractTickValue(dto: unknown): number {
    // Try to extract from first candle's data
    if (
      typeof dto === 'object' &&
      dto !== null &&
      'data' in dto &&
      Array.isArray((dto as { data: unknown[] }).data)
    ) {
      const data = (dto as { data: Array<{ tv?: number }> }).data;
      if (data.length > 0 && typeof data[0].tv === 'number') {
        return data[0].tv;
      }
    }
    // Default tick value
    return 0.01;
  }

  /**
   * Start periodic flush timer
   */
  startPeriodicFlush(): void {
    if (this.flushInterval) {
      logger.warn('Periodic flush already started');
      return;
    }

    logger.info('Starting periodic flush', {
      intervalMs: this.FLUSH_INTERVAL_MS,
      batchSize: this.BATCH_SIZE,
    });

    this.flushInterval = setInterval(() => {
      if (!this.isShuttingDown) {
        this.flushDirtyStates().catch((err) => {
          logger.error('Periodic flush failed', {
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Stop periodic flush timer
   */
  stopPeriodicFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
      logger.info('Stopped periodic flush');
    }
  }

  /**
   * Flush only dirty states in batches
   */
  async flushDirtyStates(): Promise<void> {
    const dirtyGroups = this.candleStorage.getAllDirtyGroups();

    if (dirtyGroups.length === 0) {
      logger.debug('No dirty states to flush');
      return;
    }

    const startTime = Date.now();
    const batchCount = Math.ceil(dirtyGroups.length / this.BATCH_SIZE);

    logger.info('Flushing dirty states', {
      dirtyCount: dirtyGroups.length,
      batchSize: this.BATCH_SIZE,
      batchCount,
    });

    let successCount = 0;
    let failedCount = 0;

    // Process in batches
    for (let i = 0; i < dirtyGroups.length; i += this.BATCH_SIZE) {
      const batch = dirtyGroups.slice(i, i + this.BATCH_SIZE);
      const states = batch.map(({ symbol, group }) => ({
        exchange: this.exchange,
        symbol,
        stateJson: JSON.stringify(group.toJSON()),
      }));

      try {
        await this.statePersistence.saveStateBatch(states);

        // Mark as clean after successful save
        for (const { symbol } of batch) {
          this.candleStorage.markClean(symbol);
        }
        successCount += batch.length;

        logger.debug('Flushed batch', {
          batchIndex: Math.floor(i / this.BATCH_SIZE),
          batchSize: batch.length,
        });
      } catch (error) {
        failedCount += batch.length;
        logger.error('Failed to flush batch', {
          batchIndex: Math.floor(i / this.BATCH_SIZE),
          error: error instanceof Error ? error.message : String(error),
        });
        // Don't mark as clean - will retry on next flush
        // Continue with other batches
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info('State flush completed', {
      totalStates: dirtyGroups.length,
      successCount,
      failedCount,
      batchCount,
      durationMs,
    });
  }

  /**
   * Flush ALL dirty states immediately (for graceful shutdown)
   */
  async flushAll(): Promise<void> {
    this.isShuttingDown = true;
    this.stopPeriodicFlush();

    logger.info('Flushing all dirty states for shutdown');

    try {
      await this.flushDirtyStates();
      logger.info('All dirty states flushed successfully');
    } catch (error) {
      logger.error('Failed to flush all states on shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if periodic flush is running
   */
  isPeriodicFlushRunning(): boolean {
    return this.flushInterval !== null;
  }

  /**
   * Get current configuration
   */
  getConfig(): { flushIntervalMs: number; batchSize: number } {
    return {
      flushIntervalMs: this.FLUSH_INTERVAL_MS,
      batchSize: this.BATCH_SIZE,
    };
  }
}
