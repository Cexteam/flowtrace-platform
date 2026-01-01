/**
 * Cache Adapter Bindings
 *
 * Configures cache adapter bindings using in-memory cache for all deployments.
 *
 */

import { Container } from 'inversify';
import { CORE_TYPES } from '../../core/types.js';
import {
  ICache,
  MemoryAdapter,
} from '../../../../infrastructure/cache/index.js';

/**
 * Configure cache adapter bindings
 *
 * Uses in-memory cache for all deployments.
 *
 * @param container - InversifyJS container
 */
export function configureCacheBindings(container: Container): void {
  const memoryCache = MemoryAdapter.create({
    maxSize: 1000, // Limit to 1000 entries
    defaultTtl: 3600, // 1 hour default TTL
  });

  container.bind<ICache>(CORE_TYPES.Cache).toConstantValue(memoryCache);
}
