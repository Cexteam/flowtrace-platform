/**
 * Exchange Entity - Domain Model
 *
 * Represents a cryptocurrency exchange with full configuration.
 *
 */

import {
  ExchangeStatus,
  type ImplementationStatus,
} from '../value-objects/ExchangeStatus.js';

/**
 * Exchange configuration properties
 */
export interface ExchangeProps {
  id: string;
  displayName: string;
  implementationStatus: ImplementationStatus;
  enabled: boolean;
  wsUrl: string;
  restUrl: string;
  apiKey?: string;
  apiSecret?: string;
  rateLimitPerMinute: number;
  maxReconnectDelay: number;
  maxConnectAttempts: number;
  syncRestLimit: number;
  syncCheckIntervalMinutes: number;
  syncMissingThresholdMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Exchange health information
 */
export interface ExchangeHealth {
  exchangeId: string;
  isHealthy: boolean;
  latencyMs?: number;
  lastCheckedAt: Date;
  error?: string;
}

/**
 * Exchange Entity
 * Represents a cryptocurrency exchange in the system
 */
export class Exchange {
  private _status: ExchangeStatus;

  constructor(
    public readonly id: string,
    public readonly displayName: string,
    public readonly wsUrl: string,
    public readonly restUrl: string,
    public readonly rateLimitPerMinute: number,
    public readonly maxReconnectDelay: number,
    public readonly maxConnectAttempts: number,
    public readonly syncRestLimit: number,
    public readonly syncCheckIntervalMinutes: number,
    public readonly syncMissingThresholdMinutes: number,
    implementationStatus: ImplementationStatus,
    enabled: boolean,
    public apiKey?: string,
    public apiSecret?: string,
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date()
  ) {
    this._status = new ExchangeStatus(implementationStatus, enabled);
  }

  /**
   * Get the exchange status
   */
  get status(): ExchangeStatus {
    return this._status;
  }

  /**
   * Get the implementation status
   */
  get implementationStatus(): ImplementationStatus {
    return this._status.implementationStatus;
  }

  /**
   * Get whether the exchange is enabled
   */
  get enabled(): boolean {
    return this._status.enabled;
  }

  /**
   * Domain logic: Can this exchange be enabled?
   */
  canEnable(): boolean {
    return this._status.canBeEnabled();
  }

  /**
   * Domain logic: Is this exchange operational?
   */
  isOperational(): boolean {
    return this._status.isOperational();
  }

  /**
   * Domain logic: Enable the exchange
   */
  enable(): void {
    if (!this.canEnable()) {
      throw new Error(
        `Cannot enable exchange ${this.id}: implementation status is ${this.implementationStatus}`
      );
    }
    this._status = this._status.enable();
    this.updatedAt = new Date();
  }

  /**
   * Domain logic: Disable the exchange
   */
  disable(): void {
    this._status = this._status.disable();
    this.updatedAt = new Date();
  }

  /**
   * Domain logic: Update API credentials
   */
  updateCredentials(apiKey: string, apiSecret: string): void {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.updatedAt = new Date();
  }

  /**
   * Domain logic: Check if exchange has API credentials
   */
  hasCredentials(): boolean {
    return !!this.apiKey && !!this.apiSecret;
  }

  /**
   * Convert to plain object for persistence
   */
  toJSON(): ExchangeProps {
    return {
      id: this.id,
      displayName: this.displayName,
      implementationStatus: this.implementationStatus,
      enabled: this.enabled,
      wsUrl: this.wsUrl,
      restUrl: this.restUrl,
      apiKey: this.apiKey,
      apiSecret: this.apiSecret,
      rateLimitPerMinute: this.rateLimitPerMinute,
      maxReconnectDelay: this.maxReconnectDelay,
      maxConnectAttempts: this.maxConnectAttempts,
      syncRestLimit: this.syncRestLimit,
      syncCheckIntervalMinutes: this.syncCheckIntervalMinutes,
      syncMissingThresholdMinutes: this.syncMissingThresholdMinutes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Create from plain object
   */
  static fromJSON(data: ExchangeProps): Exchange {
    return new Exchange(
      data.id,
      data.displayName,
      data.wsUrl,
      data.restUrl,
      data.rateLimitPerMinute,
      data.maxReconnectDelay,
      data.maxConnectAttempts,
      data.syncRestLimit,
      data.syncCheckIntervalMinutes,
      data.syncMissingThresholdMinutes,
      data.implementationStatus,
      data.enabled,
      data.apiKey,
      data.apiSecret,
      new Date(data.createdAt),
      new Date(data.updatedAt)
    );
  }

  /**
   * Create a new exchange with default values
   */
  static create(props: {
    id: string;
    displayName: string;
    wsUrl: string;
    restUrl: string;
    rateLimitPerMinute?: number;
    maxReconnectDelay?: number;
    maxConnectAttempts?: number;
    syncRestLimit?: number;
    syncCheckIntervalMinutes?: number;
    syncMissingThresholdMinutes?: number;
    implementationStatus?: ImplementationStatus;
    enabled?: boolean;
  }): Exchange {
    return new Exchange(
      props.id,
      props.displayName,
      props.wsUrl,
      props.restUrl,
      props.rateLimitPerMinute ?? 1200,
      props.maxReconnectDelay ?? 60000,
      props.maxConnectAttempts ?? 300,
      props.syncRestLimit ?? 1000,
      props.syncCheckIntervalMinutes ?? 5,
      props.syncMissingThresholdMinutes ?? 1,
      props.implementationStatus ?? 'not_implemented',
      props.enabled ?? false
    );
  }
}
