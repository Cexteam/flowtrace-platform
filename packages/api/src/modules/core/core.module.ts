/**
 * CoreModule - Bridge between Inversify DI and NestJS DI
 *
 * This module provides a bridge pattern to integrate @flowtrace/core services
 * (which use Inversify) into NestJS's dependency injection system.
 *
 * Phase 1: Bridge Inversify services → NestJS providers
 * Phase 2 (Future): Migrate core to NestJS DI completely
 *
 */

import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import type { Container } from 'inversify';
import {
  CANDLE_PROCESSING_TYPES,
  SYMBOL_MANAGEMENT_TYPES,
  TRADE_ROUTER_TYPES,
  CACHE_TOKEN,
  type ICache,
} from '@flowtrace/core';

/**
 * Token constants for NestJS DI
 * These are used to inject core services into NestJS controllers/services
 */
export const CORE_TOKENS = {
  // Candle Processing
  CANDLE_PROCESSING_SERVICE: 'CANDLE_PROCESSING_SERVICE',
  PROCESS_TRADE_USE_CASE: 'PROCESS_TRADE_USE_CASE',
  INITIALIZE_SYMBOL_USE_CASE: 'INITIALIZE_SYMBOL_USE_CASE',

  // Symbol Management
  SYMBOL_MANAGEMENT_SERVICE: 'SYMBOL_MANAGEMENT_SERVICE',
  SYMBOL_REPOSITORY: 'SYMBOL_REPOSITORY',
  WORKER_ASSIGNMENT_SERVICE: 'WORKER_ASSIGNMENT_SERVICE',

  // Trade Router
  TRADE_ROUTER_SERVICE: 'TRADE_ROUTER_SERVICE',
  WORKER_MANAGER_SERVICE: 'WORKER_MANAGER_SERVICE',
  ROUTING_SERVICE: 'ROUTING_SERVICE',

  // Infrastructure
  CACHE: 'CACHE',
  INVERSIFY_CONTAINER: 'INVERSIFY_CONTAINER',
} as const;

@Module({})
export class CoreModule {
  /**
   * Create CoreModule with an external Inversify container
   *
   * This is the primary way to use CoreModule - the host application
   * creates and configures the Inversify container, then passes it here.
   *
   * @param container - Configured Inversify container from @flowtrace/core
   */
  static forRoot(container: Container): DynamicModule {
    const providers = CoreModule.createProviders(container);

    return {
      module: CoreModule,
      providers,
      exports: Object.values(CORE_TOKENS),
      global: true,
    };
  }

  /**
   * Create providers that bridge Inversify services to NestJS
   */
  private static createProviders(container: Container): Provider[] {
    return [
      // Store the container itself for advanced use cases
      {
        provide: CORE_TOKENS.INVERSIFY_CONTAINER,
        useValue: container,
      },

      // Cache service
      {
        provide: CORE_TOKENS.CACHE,
        useFactory: () => {
          try {
            return container.get<ICache>(CACHE_TOKEN);
          } catch {
            console.warn('ICache not bound in container, returning null');
            return null;
          }
        },
      },

      // Candle Processing services
      {
        provide: CORE_TOKENS.CANDLE_PROCESSING_SERVICE,
        useFactory: () => {
          try {
            return container.get(
              CANDLE_PROCESSING_TYPES.CandleProcessingService
            );
          } catch {
            console.warn('CandleProcessingService not bound in container');
            return null;
          }
        },
      },
      {
        provide: CORE_TOKENS.PROCESS_TRADE_USE_CASE,
        useFactory: () => {
          try {
            return container.get(CANDLE_PROCESSING_TYPES.ProcessTradeUseCase);
          } catch {
            console.warn('ProcessTradeUseCase not bound in container');
            return null;
          }
        },
      },
      {
        provide: CORE_TOKENS.INITIALIZE_SYMBOL_USE_CASE,
        useFactory: () => {
          try {
            return container.get(
              CANDLE_PROCESSING_TYPES.InitializeSymbolUseCase
            );
          } catch {
            console.warn('InitializeSymbolUseCase not bound in container');
            return null;
          }
        },
      },

      // Symbol Management services
      {
        provide: CORE_TOKENS.SYMBOL_MANAGEMENT_SERVICE,
        useFactory: () => {
          try {
            return container.get(SYMBOL_MANAGEMENT_TYPES.SymbolManagementPort);
          } catch {
            console.warn('SymbolManagementService not bound in container');
            return null;
          }
        },
      },
      {
        provide: CORE_TOKENS.SYMBOL_REPOSITORY,
        useFactory: () => {
          try {
            return container.get(SYMBOL_MANAGEMENT_TYPES.SymbolRepository);
          } catch {
            console.warn('SymbolRepository not bound in container');
            return null;
          }
        },
      },
      {
        provide: CORE_TOKENS.WORKER_ASSIGNMENT_SERVICE,
        useFactory: () => {
          try {
            return container.get(
              SYMBOL_MANAGEMENT_TYPES.WorkerAssignmentService
            );
          } catch {
            console.warn('WorkerAssignmentService not bound in container');
            return null;
          }
        },
      },

      // Trade Router services
      {
        provide: CORE_TOKENS.TRADE_ROUTER_SERVICE,
        useFactory: () => {
          try {
            return container.get(TRADE_ROUTER_TYPES.TradeRouterService);
          } catch {
            console.warn('TradeRouterService not bound in container');
            return null;
          }
        },
      },
      {
        provide: CORE_TOKENS.WORKER_MANAGER_SERVICE,
        useFactory: () => {
          try {
            return container.get(TRADE_ROUTER_TYPES.WorkerManagerService);
          } catch {
            console.warn('WorkerManagerService not bound in container');
            return null;
          }
        },
      },
      {
        provide: CORE_TOKENS.ROUTING_SERVICE,
        useFactory: () => {
          try {
            return container.get(TRADE_ROUTER_TYPES.RoutingService);
          } catch {
            console.warn('RoutingService not bound in container');
            return null;
          }
        },
      },
    ];
  }
}
