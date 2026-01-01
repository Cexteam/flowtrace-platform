/**
 * HybridEventPublisher Adapter
 *
 * Hybrid IPC implementation of EventPublisherPort with automatic failover.
 * Uses Unix Socket as primary channel and SQLite Queue as fallback.
 *
 */

import { injectable, inject } from 'inversify';
import {
  EventPublisherPort,
  ProcessingMetrics,
} from '../../application/ports/out/EventPublisherPort.js';
import { FootprintCandle } from '../../domain/entities/FootprintCandle.js';
import type { IPCClient, RuntimeDB, QueueMessageDTO } from '@flowtrace/ipc';
import { createLogger } from '../../../../shared/lib/logger/logger.js';
import { randomUUID } from 'crypto';

const logger = createLogger('HybridEventPublisher');

/**
 * HybridEventPublisher
 * Implements EventPublisherPort with dual-channel delivery:
 * - Primary: Unix Socket (fast, sub-millisecond latency)
 * - Fallback: SQLite Queue (reliable, persistent)
 *
 * Automatically fails over to SQLite Queue when Unix Socket is unavailable
 * and reconnects with exponential backoff.
 */
@injectable()
export class HybridEventPublisher implements EventPublisherPort {
  private useUnixSocket: boolean = true;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 10;
  private readonly baseReconnectDelay: number = 1000; // 1 second
  private readonly maxReconnectDelay: number = 30000; // 30 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(
    @inject('IPCClient')
    private ipcClient: IPCClient,
    @inject('RuntimeDB')
    private runtimeDB: RuntimeDB
  ) {
    this.initializeConnection();
  }

  /**
   * Initialize Unix Socket connection
   * If connection fails, start in fallback mode
   */
  private async initializeConnection(): Promise<void> {
    try {
      await this.ipcClient.connect();
      this.useUnixSocket = true;
      this.reconnectAttempts = 0;
      logger.info('Unix Socket connected successfully');
    } catch (error) {
      logger.warn('Failed to connect to Unix Socket on initialization', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.useUnixSocket = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Publish a candle completion event
   *
   * Strategy:
   * 1. Try Unix Socket (fast path)
   * 2. On failure, write to SQLite Queue (reliable path)
   * 3. Schedule reconnection if not already scheduled
   *
   */
  async publishCandleComplete(candle: FootprintCandle): Promise<void> {
    const message = this.createMessage('candle:complete', candle.toJSON());

    // Try Unix Socket (fast path)
    if (this.useUnixSocket) {
      try {
        await this.ipcClient.send(message);
        logger.debug('Published candle via Unix Socket', {
          symbol: candle.s,
          timeframe: candle.i,
          openTime: candle.t,
        });
        return; // Success - return immediately
      } catch (error) {
        logger.warn('Unix Socket send failed, falling back to SQLite Queue', {
          symbol: candle.s,
          timeframe: candle.i,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        this.useUnixSocket = false;
        this.scheduleReconnect();
      }
    }

    // Fallback to SQLite Queue (reliable path)
    try {
      this.runtimeDB.enqueue(message);
      logger.debug('Enqueued candle to SQLite Queue', {
        symbol: candle.s,
        timeframe: candle.i,
        openTime: candle.t,
        messageId: message.id,
      });
    } catch (error) {
      logger.error('Failed to enqueue message to SQLite Queue', {
        symbol: candle.s,
        timeframe: candle.i,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error; // Critical failure - both channels failed
    }
  }

  /**
   * Publish processing metrics
   * Uses same hybrid strategy as candle events
   */
  async publishMetrics(metrics: ProcessingMetrics): Promise<void> {
    const message = this.createMessage('metrics', metrics);

    // Try Unix Socket first
    if (this.useUnixSocket) {
      try {
        await this.ipcClient.send(message);
        logger.debug('Published metrics via Unix Socket', {
          symbol: metrics.symbol,
        });
        return;
      } catch (error) {
        logger.warn('Unix Socket send failed for metrics', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        this.useUnixSocket = false;
        this.scheduleReconnect();
      }
    }

    // Fallback to SQLite Queue
    try {
      this.runtimeDB.enqueue(message);
      logger.debug('Enqueued metrics to SQLite Queue', {
        symbol: metrics.symbol,
        messageId: message.id,
      });
    } catch (error) {
      // Metrics are non-critical, log but don't throw
      logger.error('Failed to enqueue metrics', {
        symbol: metrics.symbol,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   *
   */
  private scheduleReconnect(): void {
    // Don't schedule if already scheduled
    if (this.reconnectTimer !== null) {
      return;
    }

    // Check if we've exceeded max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn(
        'Max reconnection attempts reached, staying in fallback mode',
        {
          attempts: this.reconnectAttempts,
        }
      );
      // Continue using SQLite Queue, but still try to reconnect periodically
      this.reconnectAttempts = this.maxReconnectAttempts - 1; // Allow periodic retries
    }

    // Calculate exponential backoff delay
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    logger.info('Scheduling Unix Socket reconnection', {
      attempt: this.reconnectAttempts + 1,
      delayMs: delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.attemptReconnect();
    }, delay);
  }

  /**
   * Attempt to reconnect to Unix Socket
   *
   */
  private async attemptReconnect(): Promise<void> {
    this.reconnectAttempts++;

    try {
      await this.ipcClient.connect();
      this.useUnixSocket = true;
      this.reconnectAttempts = 0; // Reset counter on success
      logger.info('Unix Socket reconnected successfully', {
        afterAttempts: this.reconnectAttempts,
      });
    } catch (error) {
      logger.warn('Unix Socket reconnection failed', {
        attempt: this.reconnectAttempts,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Schedule next attempt
      this.scheduleReconnect();
    }
  }

  /**
   * Create a queue message from event data
   */
  private createMessage(type: string, payload: unknown): QueueMessageDTO {
    return {
      id: randomUUID(),
      type,
      payload,
      timestamp: Date.now(),
    };
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ipcClient.disconnect();
  }
}
