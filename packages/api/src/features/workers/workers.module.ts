/**
 * WorkersModule - Worker management feature module
 *
 * This module provides REST endpoints for worker management.
 * It uses the InversifyBridgeModule to access core services.
 *
 */

import { Module } from '@nestjs/common';
import { WorkersController } from './presentation/controllers/index.js';
import { WorkersService } from './services/index.js';

/**
 * WorkersModule
 *
 * Note: This module relies on InversifyBridgeModule being imported globally
 * in the AppModule. The bridge provides BRIDGE_TOKENS.WORKER_POOL_PORT
 * and BRIDGE_TOKENS.WORKER_HEALTH_MONITOR_PORT which are injected into WorkersService.
 */
@Module({
  controllers: [WorkersController],
  providers: [WorkersService],
  exports: [WorkersService],
})
export class WorkersModule {}
