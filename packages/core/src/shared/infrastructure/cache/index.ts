/**
 * Cache Infrastructure
 *
 * Provides cache adapters for different deployment targets:
 * - MemoryAdapter: In-memory cache for all deployments (unified architecture)
 */

// Types
export type { ICache } from './types.js';
export { CACHE_TOKEN } from './types.js';

// Adapters
export { MemoryAdapter } from './adapters/MemoryAdapter.js';
export type { MemoryConfig } from './adapters/MemoryAdapter.js';
