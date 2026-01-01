/**
 * SymbolsModule - Symbol management feature module
 *
 * This module provides REST endpoints for symbol management.
 * It uses the InversifyBridgeModule to access core services.
 *
 */

import { Module } from '@nestjs/common';
import { SymbolsController } from './presentation/controllers/index.js';
import { SymbolsService } from './services/index.js';

/**
 * SymbolsModule
 *
 * Note: This module relies on InversifyBridgeModule being imported globally
 * in the AppModule. The bridge provides BRIDGE_TOKENS.SYMBOL_MANAGEMENT_PORT
 * which is injected into SymbolsService.
 */
@Module({
  controllers: [SymbolsController],
  providers: [SymbolsService],
  exports: [SymbolsService],
})
export class SymbolsModule {}
