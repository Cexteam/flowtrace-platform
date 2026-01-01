/**
 * Storage Infrastructure
 *
 * Provides storage adapters for tick data.
 *
 * Trade/candle persistence is now handled via @flowtrace/persistence package through IPC.
 */

// Types
export type { ITickStorage, Tick, TimeIndex } from './types.js';
export { TICK_STORAGE_TOKEN } from './types.js';

// Adapters
export * from './adapters/index.js';
