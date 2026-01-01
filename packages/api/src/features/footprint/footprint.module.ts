/**
 * FootprintModule - Footprint data feature module
 *
 * This module provides REST endpoints for footprint data.
 * It uses CandleReaderPort from @flowtrace/persistence for historical data access.
 *
 * Usage:
 * 1. Desktop app: FootprintModule.forRoot(candleReader) - inject reader from persistence
 * 2. Server app: FootprintModule (default) - creates reader from PERSISTENCE_DB_PATH env
 *
 * Note: Real-time streaming is handled separately by CandleGateway (WebSocket)
 */

import { Module, type DynamicModule } from '@nestjs/common';
import * as fs from 'fs';
import {
  createCandleReader,
  type CandleReaderPort,
} from '@flowtrace/persistence';
import { FootprintController } from './presentation/controllers/index.js';
import { FootprintService } from './services/index.js';
import { CANDLE_READER_TOKEN } from './tokens.js';

// Re-export token for external use
export { CANDLE_READER_TOKEN } from './tokens.js';

/**
 * FootprintModule
 *
 * Provides historical candle data access via CandleReaderPort.
 * Gracefully degrades when persistence database is not available.
 */
@Module({
  controllers: [FootprintController],
  providers: [
    FootprintService,
    {
      provide: CANDLE_READER_TOKEN,
      useFactory: (): CandleReaderPort | null => {
        const dbPath = process.env.PERSISTENCE_DB_PATH;
        if (!dbPath || !fs.existsSync(dbPath)) {
          return null;
        }
        try {
          return createCandleReader({ dbPath });
        } catch {
          return null;
        }
      },
    },
  ],
  exports: [FootprintService, CANDLE_READER_TOKEN],
})
export class FootprintModule {
  /**
   * Create FootprintModule with externally provided CandleReaderPort
   *
   * Use this in desktop app where persistence manages the database.
   * The candleReader should be created by persistence package.
   *
   * @param candleReader - CandleReaderPort instance from persistence
   * @returns DynamicModule configured with the provided reader
   *
   * @example
   * ```typescript
   * // In desktop bootstrap
   * import { createCandleReader } from '@flowtrace/persistence';
   *
   * const candleReader = createCandleReader({
   *   dbPath: paths.candleStorageDir + '/binance/candles.db'
   * });
   *
   * // Pass to API bootstrap
   * await bootstrapApi(container, {
   *   mode: 'context',
   *   candleReader
   * });
   * ```
   */
  static forRoot(candleReader: CandleReaderPort | null): DynamicModule {
    return {
      module: FootprintModule,
      controllers: [FootprintController],
      providers: [
        FootprintService,
        {
          provide: CANDLE_READER_TOKEN,
          useValue: candleReader,
        },
      ],
      exports: [FootprintService, CANDLE_READER_TOKEN],
    };
  }
}
