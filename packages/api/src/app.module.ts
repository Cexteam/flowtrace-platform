/**
 * FlowTrace API Application Module
 *
 * Root module that composes all feature modules and provides
 * the bridge between Inversify DI (from @flowtrace/core) and NestJS DI.
 *
 * Architecture:
 * - Uses unified SQLite-based architecture for all deployments (desktop, server)
 * - InversifyBridgeModule: Bridges core Port In interfaces to NestJS
 * - CoreModule: Legacy bridge (kept for backward compatibility)
 * - Feature Modules: Controllers that use bridged ports
 *
 * Bootstrap Order:
 * 1. Host app calls bootstrap() from @flowtrace/core (no platform parameter)
 * 2. Host app passes container to AppModule.forRoot()
 * 3. InversifyBridgeModule bridges Port In interfaces to NestJS
 * 4. Feature modules inject ports via NestJS DI
 */

import { Module, type DynamicModule } from '@nestjs/common';
import type { Container } from 'inversify';
import type { CandleReaderPort, GapReaderPort } from '@flowtrace/persistence';
import { InversifyBridgeModule } from './bridge/index.js';
import { CoreModule } from './modules/core/core.module.js';

// Feature modules (features/ pattern)
import { SymbolsModule } from './features/symbols/index.js';
import { ExchangesModule } from './features/exchanges/index.js';
import { WorkersModule } from './features/workers/index.js';
import { DataQualityModule } from './features/dataQuality/index.js';
import { FootprintModule } from './features/footprint/index.js';
import { WebSocketModule } from './features/websocket/index.js';

/**
 * Options for AppModule.forRoot()
 */
export interface AppModuleOptions {
  /**
   * CandleReaderPort instance for reading historical candle data.
   * If provided, FootprintModule will use this reader.
   * If not provided, FootprintModule will try to create one from PERSISTENCE_DB_PATH env.
   */
  candleReader?: CandleReaderPort | null;

  /**
   * GapReaderPort instance for reading gap records.
   * If provided, DataQualityModule will use this reader.
   * If not provided, DataQualityModule will return empty results.
   */
  gapReader?: GapReaderPort | null;
}

@Module({})
export class AppModule {
  /**
   * Create the AppModule with an external Inversify container
   *
   * This allows the host application (apps/server, apps/desktop) to configure
   * infrastructure adapters and pass them to the API layer.
   *
   * Uses the unified SQLite architecture - container is created via
   * ContainerFactory.createMainThread() without platform parameter.
   *
   * @param coreContainer - Inversify container from @flowtrace/core
   * @param options - Optional configuration including candleReader and gapReader
   */
  static forRoot(
    coreContainer: Container,
    options?: AppModuleOptions
  ): DynamicModule {
    // Determine which FootprintModule to use
    const footprintModule =
      options?.candleReader !== undefined
        ? FootprintModule.forRoot(options.candleReader)
        : FootprintModule;

    // Determine which DataQualityModule to use
    const dataQualityModule =
      options?.gapReader !== undefined
        ? DataQualityModule.forRoot(options.gapReader)
        : DataQualityModule;

    return {
      module: AppModule,
      imports: [
        // Bridge module - exports Port In interfaces to NestJS DI
        InversifyBridgeModule.forRoot(coreContainer),
        // Legacy core module - kept for backward compatibility
        CoreModule.forRoot(coreContainer),
        // Feature modules (features/ pattern with shared services)
        SymbolsModule,
        ExchangesModule,
        WorkersModule,
        dataQualityModule,
        footprintModule,
        // WebSocket feature module
        WebSocketModule,
      ],
    };
  }
}
