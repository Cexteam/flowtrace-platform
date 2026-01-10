/**
 * ConnectionRotator - Manages proactive WebSocket connection rotation
 *
 * Implements dual-connection strategy to ensure zero-gap when Binance
 * WebSocket combined stream disconnects after 24h.
 *
 * Key behaviors:
 * - Tracks connection age and schedules rotation before 24h limit
 * - Creates secondary connection before closing primary
 * - Maintains overlap period where both connections receive trades
 * - Persistent retry if secondary connection fails
 * - Falls back to reactive reconnection if rotation fails
 */

import { injectable } from 'inversify';
import { WebSocketManager } from './WebSocketManager.js';
import {
  RotationConfig,
  getRotationConfig,
  formatDuration,
} from './RotationConfig.js';
import { createLogger } from '../../../../shared/lib/logger/logger.js';

const logger = createLogger('ConnectionRotator');

/**
 * Connection info for status reporting
 */
export interface ConnectionInfo {
  id: string;
  isPrimary: boolean;
  startTime: number | null;
  connectionAge: number;
  isConnected: boolean;
}

/**
 * Rotation status for monitoring
 */
export interface RotationStatus {
  enabled: boolean;
  isRotating: boolean;
  primaryConnection: ConnectionInfo | null;
  secondaryConnection: ConnectionInfo | null;
  nextRotationTime: number | null;
  lastRotationTime: number | null;
  rotationCount: number;
  failedRotationCount: number;
}

/**
 * Factory function type for creating WebSocketManager instances
 */
export type WebSocketManagerFactory = (url: string) => WebSocketManager;

/**
 * ConnectionRotator service
 */
@injectable()
export class ConnectionRotator {
  private primaryManager: WebSocketManager | null = null;
  private secondaryManager: WebSocketManager | null = null;
  private rotationTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private overlapTimer: NodeJS.Timeout | null = null;

  private isRotating = false;
  private activeSymbols: string[] = [];
  private config: RotationConfig;

  // Statistics
  private rotationCount = 0;
  private failedRotationCount = 0;
  private lastRotationTime: number | null = null;

  // Callbacks
  private onTradeMessage?: (data: any, connectionId: string) => void;
  private onSubscribe?: (
    manager: WebSocketManager,
    symbols: string[]
  ) => Promise<void>;

  constructor(
    private wsUrl: string,
    private wsManagerFactory: WebSocketManagerFactory,
    config?: Partial<RotationConfig>
  ) {
    this.config = { ...getRotationConfig(), ...config };
    logger.info('ConnectionRotator initialized', {
      enabled: this.config.enabled,
      triggerMs: formatDuration(this.config.triggerMs),
      overlapMs: formatDuration(this.config.overlapMs),
      retryIntervalMs: formatDuration(this.config.retryIntervalMs),
    });
  }

  /**
   * Set callback for trade messages
   * Called when either connection receives a trade
   */
  setOnTradeMessage(callback: (data: any, connectionId: string) => void): void {
    this.onTradeMessage = callback;
  }

  /**
   * Set callback for subscribing symbols on a connection
   */
  setOnSubscribe(
    callback: (manager: WebSocketManager, symbols: string[]) => Promise<void>
  ): void {
    this.onSubscribe = callback;
  }

  /**
   * Start with initial connection (becomes primary)
   */
  async start(symbols: string[]): Promise<void> {
    if (this.primaryManager) {
      logger.warn('ConnectionRotator already started');
      return;
    }

    this.activeSymbols = [...symbols];

    // Create primary connection
    this.primaryManager = this.createWebSocketManager('primary');
    await this.primaryManager.connect();

    // Subscribe to symbols
    if (this.onSubscribe && symbols.length > 0) {
      await this.onSubscribe(this.primaryManager, symbols);
    }

    // Schedule rotation if enabled
    if (this.config.enabled) {
      this.scheduleRotation();
    }

    logger.info('ConnectionRotator started', {
      symbols: symbols.length,
      rotationEnabled: this.config.enabled,
      nextRotation: this.config.enabled
        ? formatDuration(this.config.triggerMs)
        : 'disabled',
    });
  }

  /**
   * Stop all connections and cleanup
   */
  async stop(): Promise<void> {
    this.clearAllTimers();

    if (this.secondaryManager) {
      await this.secondaryManager.disconnect();
      this.secondaryManager = null;
    }

    if (this.primaryManager) {
      await this.primaryManager.disconnect();
      this.primaryManager = null;
    }

    this.activeSymbols = [];
    this.isRotating = false;

    logger.info('ConnectionRotator stopped');
  }

  /**
   * Subscribe symbols on all active connections
   */
  async subscribeSymbols(symbols: string[]): Promise<void> {
    this.activeSymbols = [...new Set([...this.activeSymbols, ...symbols])];

    if (this.onSubscribe) {
      if (this.primaryManager) {
        await this.onSubscribe(this.primaryManager, symbols);
      }
      if (this.secondaryManager) {
        await this.onSubscribe(this.secondaryManager, symbols);
      }
    }
  }

  /**
   * Unsubscribe symbols from all active connections
   * Note: Actual unsubscribe logic should be handled by the adapter
   */
  async unsubscribeSymbols(symbols: string[]): Promise<void> {
    this.activeSymbols = this.activeSymbols.filter(
      (s) => !symbols.includes(s.toUpperCase())
    );
  }

  /**
   * Get status of all connections
   */
  getStatus(): RotationStatus {
    return {
      enabled: this.config.enabled,
      isRotating: this.isRotating,
      primaryConnection: this.getConnectionInfo(this.primaryManager, true),
      secondaryConnection: this.getConnectionInfo(this.secondaryManager, false),
      nextRotationTime: this.calculateNextRotationTime(),
      lastRotationTime: this.lastRotationTime,
      rotationCount: this.rotationCount,
      failedRotationCount: this.failedRotationCount,
    };
  }

  /**
   * Get primary WebSocketManager (for backward compatibility)
   */
  getPrimaryManager(): WebSocketManager | null {
    return this.primaryManager;
  }

  /**
   * Check if rotation is in progress
   */
  getIsRotating(): boolean {
    return this.isRotating;
  }

  /**
   * Force rotation (for testing/manual trigger)
   */
  async forceRotation(): Promise<void> {
    logger.info('Force rotation triggered');
    await this.initiateRotation();
  }

  /**
   * Create WebSocketManager with message handler
   */
  private createWebSocketManager(
    role: 'primary' | 'secondary'
  ): WebSocketManager {
    const manager = this.wsManagerFactory(this.wsUrl);

    // Register message handler
    manager.registerMessageHandler('stream', (data: any) => {
      if (this.onTradeMessage) {
        this.onTradeMessage(data, manager.getConnectionId());
      }
    });

    // Set up reconnect callback for reactive reconnection
    manager.setOnReconnect(async () => {
      // Log warning if this is reactive reconnection (not proactive rotation)
      if (role === 'primary' && !this.isRotating) {
        logger.warn(
          'Reactive reconnection occurred - proactive rotation was not successful',
          {
            connectionId: manager.getConnectionId(),
            rotationEnabled: this.config.enabled,
            failedRotationCount: this.failedRotationCount,
          }
        );
      }

      // Re-subscribe to symbols after reconnection
      if (this.onSubscribe && this.activeSymbols.length > 0) {
        await this.onSubscribe(manager, this.activeSymbols);
      }
    });

    logger.debug(`Created ${role} WebSocketManager`, {
      connectionId: manager.getConnectionId(),
    });

    return manager;
  }

  /**
   * Schedule rotation based on config
   */
  private scheduleRotation(): void {
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
    }

    this.rotationTimer = setTimeout(() => {
      this.initiateRotation();
    }, this.config.triggerMs);

    logger.debug('Rotation scheduled', {
      triggerIn: formatDuration(this.config.triggerMs),
    });
  }

  /**
   * Initiate rotation process
   */
  private async initiateRotation(): Promise<void> {
    if (this.isRotating) {
      logger.warn('Rotation already in progress');
      return;
    }

    if (!this.primaryManager) {
      logger.warn('No primary connection to rotate');
      return;
    }

    this.isRotating = true;
    logger.info('Initiating connection rotation', {
      primaryAge: formatDuration(this.primaryManager.getConnectionAge()),
    });

    try {
      await this.createSecondaryConnection();
    } catch (error) {
      logger.error('Failed to create secondary connection', error);
      this.scheduleRetry();
    }
  }

  /**
   * Create secondary connection
   */
  private async createSecondaryConnection(): Promise<void> {
    // Create secondary
    this.secondaryManager = this.createWebSocketManager('secondary');

    try {
      await this.secondaryManager.connect();

      // Subscribe to symbols
      if (this.onSubscribe && this.activeSymbols.length > 0) {
        await this.onSubscribe(this.secondaryManager, this.activeSymbols);
      }

      logger.info('Secondary connection established', {
        connectionId: this.secondaryManager.getConnectionId(),
        symbols: this.activeSymbols.length,
      });

      // Clear retry timer if any
      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }

      // Schedule overlap completion
      this.scheduleOverlapCompletion();
    } catch (error) {
      // Cleanup failed secondary
      if (this.secondaryManager) {
        await this.secondaryManager.disconnect();
        this.secondaryManager = null;
      }
      throw error;
    }
  }

  /**
   * Schedule retry for secondary connection
   */
  private scheduleRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    this.failedRotationCount++;

    logger.warn('Scheduling secondary connection retry', {
      retryIn: formatDuration(this.config.retryIntervalMs),
      failedAttempts: this.failedRotationCount,
    });

    this.retryTimer = setTimeout(async () => {
      try {
        await this.createSecondaryConnection();
      } catch (error) {
        logger.error('Secondary connection retry failed', error);
        // Keep retrying until primary disconnects
        if (this.primaryManager?.getConnectionStatus().isConnected) {
          this.scheduleRetry();
        } else {
          logger.error(
            'Primary disconnected during rotation retry, falling back to reactive reconnect'
          );
          this.isRotating = false;
        }
      }
    }, this.config.retryIntervalMs);
  }

  /**
   * Schedule overlap completion (close primary, promote secondary)
   */
  private scheduleOverlapCompletion(): void {
    if (this.overlapTimer) {
      clearTimeout(this.overlapTimer);
    }

    logger.info('Overlap period started', {
      duration: formatDuration(this.config.overlapMs),
    });

    this.overlapTimer = setTimeout(async () => {
      await this.completeRotation();
    }, this.config.overlapMs);
  }

  /**
   * Complete rotation: close primary, promote secondary
   */
  private async completeRotation(): Promise<void> {
    if (!this.secondaryManager) {
      logger.error('No secondary connection to promote');
      this.isRotating = false;
      return;
    }

    const oldPrimaryId = this.primaryManager?.getConnectionId();
    const oldPrimaryAge = this.primaryManager?.getConnectionAge() || 0;

    // Close old primary
    if (this.primaryManager) {
      await this.primaryManager.disconnect();
    }

    // Promote secondary to primary
    this.primaryManager = this.secondaryManager;
    this.secondaryManager = null;

    // Update statistics
    this.rotationCount++;
    this.lastRotationTime = Date.now();
    this.isRotating = false;

    logger.info('Rotation completed', {
      oldPrimaryId,
      oldPrimaryAge: formatDuration(oldPrimaryAge),
      newPrimaryId: this.primaryManager.getConnectionId(),
      totalRotations: this.rotationCount,
    });

    // Schedule next rotation
    if (this.config.enabled) {
      this.scheduleRotation();
    }
  }

  /**
   * Get connection info for status reporting
   */
  private getConnectionInfo(
    manager: WebSocketManager | null,
    isPrimary: boolean
  ): ConnectionInfo | null {
    if (!manager) return null;

    const status = manager.getConnectionStatus();
    return {
      id: manager.getConnectionId(),
      isPrimary,
      startTime: manager.getConnectionStartTime(),
      connectionAge: manager.getConnectionAge(),
      isConnected: status.isConnected,
    };
  }

  /**
   * Calculate next rotation time
   */
  private calculateNextRotationTime(): number | null {
    if (!this.config.enabled || !this.primaryManager) {
      return null;
    }

    const startTime = this.primaryManager.getConnectionStartTime();
    if (!startTime) return null;

    return startTime + this.config.triggerMs;
  }

  /**
   * Clear all timers
   */
  private clearAllTimers(): void {
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.overlapTimer) {
      clearTimeout(this.overlapTimer);
      this.overlapTimer = null;
    }
  }
}
