/**
 * WebSocketModule - WebSocket feature module
 *
 * Provides real-time updates via WebSocket:
 * - CandleGateway: Real-time candle streaming (/ws namespace)
 * - StatusGateway: Worker and symbol status updates (/ws/status namespace)
 *
 */

import { Module } from '@nestjs/common';
import { CandleGateway, StatusGateway } from './gateways/index.js';

@Module({
  providers: [CandleGateway, StatusGateway],
  exports: [CandleGateway, StatusGateway],
})
export class WebSocketModule {}
