/**
 * ExchangesModule - Exchange management feature module
 *
 * This module provides REST endpoints for exchange management.
 * It uses the InversifyBridgeModule to access core services.
 *
 */

import { Module } from '@nestjs/common';
import { ExchangesController } from './presentation/controllers/index.js';
import { ExchangesService } from './services/index.js';

/**
 * ExchangesModule
 *
 * Note: This module relies on InversifyBridgeModule being imported globally
 * in the AppModule. The bridge provides BRIDGE_TOKENS.EXCHANGE_MANAGEMENT_PORT
 * which is injected into ExchangesService.
 */
@Module({
  controllers: [ExchangesController],
  providers: [ExchangesService],
  exports: [ExchangesService],
})
export class ExchangesModule {}
