/**
 * Cache Infrastructure Types
 *
 * Defines cache interface for dependency inversion.
 * Allows different cache implementations (in-memory, etc.).
 *
 * All deployments now use in-memory cache with IPC-based persistence.
 *
 */

/**
 * Cache interface for key-value storage with pub/sub support
 */
export interface ICache {
  /**
   * Get a value from the cache
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in the cache with optional TTL (in seconds)
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Delete a value from the cache
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a key exists in the cache
   */
  exists(key: string): Promise<boolean>;

  /**
   * Publish a message to a channel (pub/sub)
   */
  publish(channel: string, message: unknown): Promise<void>;

  /**
   * Subscribe to a channel (pub/sub)
   * Returns an unsubscribe function
   */
  subscribe(
    channel: string,
    handler: (message: unknown) => void
  ): Promise<() => void>;

  /**
   * Subscribe to a pattern of channels (pub/sub)
   * Returns an unsubscribe function
   */
  psubscribe(
    pattern: string,
    handler: (channel: string, message: unknown) => void
  ): Promise<() => void>;

  /**
   * Close the cache connection
   */
  close(): Promise<void>;
}

/**
 * DI symbol for cache binding
 */
export const CACHE_TOKEN = Symbol.for('ICache');
