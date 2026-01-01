/**
 * ExchangeStatus Value Object
 *
 * Represents the implementation status of an exchange.
 * Immutable value object that encapsulates exchange status logic.
 *
 */

/**
 * Implementation status of an exchange
 */
export type ImplementationStatus =
  | 'implemented'
  | 'partial'
  | 'not_implemented';

/**
 * ExchangeStatus value object
 * Immutable representation of an exchange's operational status
 */
export class ExchangeStatus {
  private readonly _implementationStatus: ImplementationStatus;
  private readonly _enabled: boolean;

  constructor(implementationStatus: ImplementationStatus, enabled: boolean) {
    this._implementationStatus = implementationStatus;
    this._enabled = enabled;
  }

  /**
   * Get the implementation status
   */
  get implementationStatus(): ImplementationStatus {
    return this._implementationStatus;
  }

  /**
   * Get whether the exchange is enabled
   */
  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * Check if the exchange is fully operational
   * An exchange is operational if it's implemented and enabled
   */
  isOperational(): boolean {
    return this._implementationStatus === 'implemented' && this._enabled;
  }

  /**
   * Check if the exchange can be enabled
   * Only implemented or partial exchanges can be enabled
   */
  canBeEnabled(): boolean {
    return this._implementationStatus !== 'not_implemented';
  }

  /**
   * Create a new status with enabled set to true
   */
  enable(): ExchangeStatus {
    if (!this.canBeEnabled()) {
      throw new Error('Cannot enable an exchange that is not implemented');
    }
    return new ExchangeStatus(this._implementationStatus, true);
  }

  /**
   * Create a new status with enabled set to false
   */
  disable(): ExchangeStatus {
    return new ExchangeStatus(this._implementationStatus, false);
  }

  /**
   * Check if this status equals another
   */
  equals(other: ExchangeStatus): boolean {
    return (
      this._implementationStatus === other._implementationStatus &&
      this._enabled === other._enabled
    );
  }

  /**
   * Create from plain object
   */
  static fromJSON(data: {
    implementationStatus: ImplementationStatus;
    enabled: boolean;
  }): ExchangeStatus {
    return new ExchangeStatus(data.implementationStatus, data.enabled);
  }

  /**
   * Convert to plain object
   */
  toJSON(): { implementationStatus: ImplementationStatus; enabled: boolean } {
    return {
      implementationStatus: this._implementationStatus,
      enabled: this._enabled,
    };
  }

  toString(): string {
    return `ExchangeStatus(${this._implementationStatus}, enabled=${this._enabled})`;
  }
}
