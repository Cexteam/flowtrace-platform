/**
 * Bridge Module - NestJS to Inversify Bridge
 *
 * Exports the bridge module and tokens for connecting NestJS DI
 * with the Inversify container from @flowtrace/core.
 *
 */

export {
  InversifyBridgeModule,
  BRIDGE_TOKENS,
  type BridgeTokens,
} from './inversify-bridge.module.js';
