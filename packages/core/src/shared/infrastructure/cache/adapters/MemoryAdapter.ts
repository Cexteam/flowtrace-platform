/**
 * Memory Cache Adapter
 * Implements ICache interface for in-memory caching
 * Supports key-value operations and pub/sub emulation
 * Ideal for desktop deployments and testing
 */

import type { ICache } from '../types.js';

/**
 * Memory adapter configuration options
 */
export interface MemoryConfig {
  /** Maximum number of entries in the cache (0 = unlimited) */
  maxSize?: number;
  /** Default TTL in seconds (0 = no expiration) */
  defaultTtl?: number;
}

/**
 * Internal cache entry with expiration tracking
 */
interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
}

/**
 * Memory adapter implementing ICache interface
 * Provides in-memory cache with pub/sub emulation
 */
export class MemoryAdapter implements ICache {
  private store = new Map<string, CacheEntry<unknown>>();
  private subscribers = new Map<string, Set<(message: unknown) => void>>();
  private patternSubscribers = new Map<
    string,
    Set<(channel: string, message: unknown) => void>
  >();
  private maxSize: number;
  private defaultTtl: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: MemoryConfig = {}) {
    this.maxSize = config.maxSize ?? 0;
    this.defaultTtl = config.defaultTtl ?? 0;

    // Start cleanup interval for expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Create a MemoryAdapter with configuration
   */
  static create(config: MemoryConfig = {}): MemoryAdapter {
    return new MemoryAdapter(config);
  }

  /**
   * Get a value from the cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set a value in the cache with optional TTL (in seconds)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Enforce max size with LRU-like eviction (remove oldest entries)
    if (this.maxSize > 0 && this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) {
        this.store.delete(firstKey);
      }
    }

    const effectiveTtl = ttl ?? this.defaultTtl;
    const entry: CacheEntry<T> = {
      value,
      expiresAt:
        effectiveTtl > 0 ? Date.now() + effectiveTtl * 1000 : undefined,
    };

    this.store.set(key, entry);
  }

  /**
   * Delete a value from the cache
   */
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  /**
   * Check if a key exists in the cache
   */
  async exists(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) {
      return false;
    }

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Publish a message to a channel (in-memory pub/sub emulation)
   */
  async publish(channel: string, message: unknown): Promise<void> {
    // Notify exact channel subscribers
    const handlers = this.subscribers.get(channel);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message);
        } catch (err) {
          console.error(
            `Error in subscriber handler for channel ${channel}:`,
            err
          );
        }
      }
    }

    // Notify pattern subscribers
    for (const [pattern, patternHandlers] of this.patternSubscribers) {
      if (this.matchPattern(pattern, channel)) {
        for (const handler of patternHandlers) {
          try {
            handler(channel, message);
          } catch (err) {
            console.error(
              `Error in pattern subscriber handler for ${pattern}:`,
              err
            );
          }
        }
      }
    }
  }

  /**
   * Subscribe to a channel
   * Returns an unsubscribe function
   */
  async subscribe(
    channel: string,
    handler: (message: unknown) => void
  ): Promise<() => void> {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    this.subscribers.get(channel)!.add(handler);

    return () => {
      const handlers = this.subscribers.get(channel);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.subscribers.delete(channel);
        }
      }
    };
  }

  /**
   * Subscribe to a pattern of channels
   * Returns an unsubscribe function
   */
  async psubscribe(
    pattern: string,
    handler: (channel: string, message: unknown) => void
  ): Promise<() => void> {
    if (!this.patternSubscribers.has(pattern)) {
      this.patternSubscribers.set(pattern, new Set());
    }
    this.patternSubscribers.get(pattern)!.add(handler);

    return () => {
      const handlers = this.patternSubscribers.get(pattern);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.patternSubscribers.delete(pattern);
        }
      }
    };
  }

  /**
   * Close the cache (cleanup resources)
   */
  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
    this.subscribers.clear();
    this.patternSubscribers.clear();
  }

  /**
   * Match a glob-style pattern against a channel name
   * Supports * (match any characters) and ? (match single character)
   */
  private matchPattern(pattern: string, channel: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*') // * matches any characters
      .replace(/\?/g, '.'); // ? matches single character

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(channel);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get the current size of the cache
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Clear all entries from the cache
   */
  async clear(): Promise<void> {
    this.store.clear();
  }
}
