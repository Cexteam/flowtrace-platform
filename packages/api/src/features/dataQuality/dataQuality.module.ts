/**
 * DataQuality Module
 *
 * Provides data quality checking functionality.
 * Supports optional GapReader injection for read-only gap access.
 */

import { Module, DynamicModule } from '@nestjs/common';
import type { GapReaderPort } from '@flowtrace/persistence';
import { DataQualityController } from './presentation/controllers/index.js';
import {
  DataQualityService,
  GAP_READER_TOKEN,
} from './services/DataQualityService.js';

@Module({
  controllers: [DataQualityController],
  providers: [
    {
      provide: GAP_READER_TOKEN,
      useValue: null, // Default: no gap reader
    },
    DataQualityService,
  ],
  exports: [DataQualityService],
})
export class DataQualityModule {
  /**
   * Create module with external GapReader
   * Used by desktop app to inject GapReader from persistence
   */
  static forRoot(gapReader: GapReaderPort | null): DynamicModule {
    return {
      module: DataQualityModule,
      providers: [
        {
          provide: GAP_READER_TOKEN,
          useValue: gapReader,
        },
        DataQualityService,
      ],
      exports: [DataQualityService],
    };
  }
}
