/**
 * InversifyBridgeModule - Bridge between Inversify DI and NestJS DI
 *
 * This module provides a clean bridge pattern to integrate @flowtrace/core services
 * (which use Inversify) into NestJS's dependency injection system.
 *
 * The bridge exports core Port In interfaces, allowing NestJS controllers
 * to inject and use core business logic without coupling to Inversify directly.
 *
 * Works with the unified SQLite architecture - all deployments (desktop, server)
 * use the same container configuration from ContainerFactory.createMainThread().
 *
 */

import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import type { Container } from 'inversify';
import {
  SYMBOL_MANAGEMENT_TYPES,
  CANDLE_PROCESSING_TYPES,
  WORKER_MANAGEMENT_TYPES,
  EXCHANGE_MANAGEMENT_TYPES,
  CACHE_TOKEN,
} from '@flowtrace/core';
import type {
  SymbolManagementPort,
  CandleProcessingPort,
  ExchangeManagementPort,
  WorkerManagementPort,
  WorkerStatusPort,
  ICache,
} from '@flowtrace/core';

/**
 * Bridge tokens for NestJS DI
 *
 * These tokens are used to inject core Port In interfaces into NestJS controllers.
 * Using string tokens (converted from Symbols) for NestJS compatibility.
 */
export const BRIDGE_TOKENS = {
  // Inversify Container (for advanced use cases)
  INVERSIFY_CONTAINER: 'INVERSIFY_CONTAINER',

  // Port In Interfaces (Driving Ports)
  SYMBOL_MANAGEMENT_PORT: 'SymbolManagementPort',
  CANDLE_PROCESSING_PORT: 'CandleProcessingPort',

  // Worker Management Ports (new unified ports)
  WORKER_MANAGEMENT_PORT: 'WorkerManagementPort',
  WORKER_STATUS_PORT: 'WorkerStatusPort',

  // Exchange Management Ports
  EXCHANGE_MANAGEMENT_PORT: 'ExchangeManagementPort',

  // Infrastructure Services
  CACHE: 'Cache',
} as const;

/**
 * Type for bridge token values
 */
export type BridgeTokens = typeof BRIDGE_TOKENS;

/**
 * InversifyBridgeModule
 *
 * Provides a bridge between Inversify container and NestJS DI system.
 * This module should be imported by feature modules that need access to core services.
 *
 * Works with the unified SQLite architecture - the same container configuration
 * is used for all deployments (desktop, server).
 *
 * Usage:
 * ```typescript
 * // In AppModule
 * @Module({
 *   imports: [InversifyBridgeModule.forRoot(container)],
 * })
 * export class AppModule {}
 *
 * // In Controller
 * @Controller('symbols')
 * export class SymbolsController {
 *   constructor(
 *     @Inject(BRIDGE_TOKENS.SYMBOL_MANAGEMENT_PORT)
 *     private readonly symbolPort: SymbolManagementPort
 *   ) {}
 * }
 * ```
 */
@Module({})
export class InversifyBridgeModule {
  /**
   * Create the bridge module with an external Inversify container
   *
   * This is the primary way to use InversifyBridgeModule. The host application
   * creates and configures the Inversify container first, then passes it here.
   *
   * Uses the unified SQLite architecture - container is created via
   * ContainerFactory.createMainThread() without platform parameter.
   *
   * @param container - Configured Inversify container from @flowtrace/core
   * @returns DynamicModule with all port providers
   *
   */
  static forRoot(container: Container): DynamicModule {
    const providers = InversifyBridgeModule.createProviders(container);
    const exportedTokens = Object.values(BRIDGE_TOKENS);

    return {
      module: InversifyBridgeModule,
      providers,
      exports: exportedTokens,
      global: true, // Make available throughout the application
    };
  }

  /**
   * Create providers that bridge Inversify services to NestJS
   *
   * Each provider uses a factory function to resolve the service from
   * the Inversify container. This ensures lazy resolution and proper
   * error handling.
   *
   * All services use the unified SQLite-based adapters - no platform-specific
   * bindings are assumed.
   *
   * @param container - Inversify container
   * @returns Array of NestJS providers
   */
  private static createProviders(container: Container): Provider[] {
    return [
      // Store the container itself for advanced use cases
      {
        provide: BRIDGE_TOKENS.INVERSIFY_CONTAINER,
        useValue: container,
      },

      // ========================================
      // Symbol Management Ports
      // ========================================
      {
        provide: BRIDGE_TOKENS.SYMBOL_MANAGEMENT_PORT,
        useFactory: () => {
          return InversifyBridgeModule.safeResolve<SymbolManagementPort>(
            container,
            SYMBOL_MANAGEMENT_TYPES.SymbolManagementPort,
            'SymbolManagementPort'
          );
        },
      },

      // ========================================
      // Candle Processing Ports
      // ========================================
      {
        provide: BRIDGE_TOKENS.CANDLE_PROCESSING_PORT,
        useFactory: () => {
          return InversifyBridgeModule.safeResolve<CandleProcessingPort>(
            container,
            CANDLE_PROCESSING_TYPES.CandleProcessingPort,
            'CandleProcessingPort'
          );
        },
      },

      // ========================================
      // Worker Management Ports (new unified ports)
      // ========================================
      {
        provide: BRIDGE_TOKENS.WORKER_MANAGEMENT_PORT,
        useFactory: () => {
          return InversifyBridgeModule.safeResolve<WorkerManagementPort>(
            container,
            WORKER_MANAGEMENT_TYPES.WorkerManagementPort,
            'WorkerManagementPort'
          );
        },
      },
      {
        provide: BRIDGE_TOKENS.WORKER_STATUS_PORT,
        useFactory: () => {
          return InversifyBridgeModule.safeResolve<WorkerStatusPort>(
            container,
            WORKER_MANAGEMENT_TYPES.WorkerStatusPort,
            'WorkerStatusPort'
          );
        },
      },

      // ========================================
      // Exchange Management Ports
      // ========================================
      {
        provide: BRIDGE_TOKENS.EXCHANGE_MANAGEMENT_PORT,
        useFactory: () => {
          return InversifyBridgeModule.safeResolve<ExchangeManagementPort>(
            container,
            EXCHANGE_MANAGEMENT_TYPES.ExchangeManagementPort,
            'ExchangeManagementPort'
          );
        },
      },

      // ========================================
      // Settings Management Ports
      // Note: SettingsManagementPort will be added when sync feature is implemented
      // ========================================

      // ========================================
      // Infrastructure Services
      // ========================================
      {
        provide: BRIDGE_TOKENS.CACHE,
        useFactory: () => {
          return InversifyBridgeModule.safeResolve<ICache>(
            container,
            CACHE_TOKEN,
            'Cache'
          );
        },
      },
    ];
  }

  /**
   * Safely resolve a service from the Inversify container
   *
   * Returns null if the service is not bound, with a warning log.
   * This allows the application to start even if some services are not configured.
   *
   * @param container - Inversify container
   * @param token - Service identifier (Symbol)
   * @param name - Human-readable name for logging
   * @returns Resolved service or null
   */
  private static safeResolve<T>(
    container: Container,
    token: symbol,
    name: string
  ): T | null {
    try {
      if (container.isBound(token)) {
        return container.get<T>(token);
      }
      console.warn(`[InversifyBridge] ${name} not bound in container`);
      return null;
    } catch (error) {
      console.warn(
        `[InversifyBridge] Failed to resolve ${name}:`,
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }
}
