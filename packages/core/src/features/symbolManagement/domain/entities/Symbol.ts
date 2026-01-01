/**
 * Symbol Entity - Domain Model
 * Represents a trading symbol with full lifecycle management
 *
 * Multi-Exchange Support:
 * - Works with any exchange (Binance, Bybit, OKX, etc.)
 * - Exchange-specific metadata stored in exchangeMetadata field
 * - Common fields (config, status) work across all exchanges
 */

import type { Exchange, ExchangeMetadata } from '../types/ExchangeMetadata.js';
import { isSymbolActiveOnExchange } from '../types/ExchangeMetadata.js';

export enum SymbolStatus {
  ACTIVE = 'active', // Active and processing
  INACTIVE = 'inactive', // Disabled by admin
  DELISTED = 'delisted', // Removed from exchange
  PENDING_REVIEW = 'pending_review', // New symbol awaiting admin approval
}

export interface SymbolConfig {
  tickValue: number;
  minQuantity: number;
  maxQuantity: number;
  pricePrecision: number;
  quantityPrecision: number;
}

export class Symbol {
  constructor(
    public readonly id: string,
    public readonly symbol: string,
    public readonly exchange: Exchange,
    public config: SymbolConfig,
    public status: SymbolStatus,
    public isStreaming: boolean,
    public isProcessing: boolean,
    public exchangeMetadata: ExchangeMetadata | null, // Exchange-specific data
    public enabledByAdmin: boolean,
    public delistedAt?: Date,
    public notes?: string,
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public lastSyncAt: Date = new Date()
  ) {}

  /**
   * Domain logic: Can this symbol be activated?
   * Works across all exchanges by checking exchange-specific status
   */
  canActivate(): boolean {
    if (this.status === SymbolStatus.DELISTED || !this.enabledByAdmin) {
      return false;
    }

    // Check if symbol is active on its exchange
    if (this.exchangeMetadata) {
      return isSymbolActiveOnExchange(this.exchangeMetadata);
    }

    return false;
  }

  /**
   * Domain logic: Should this symbol be flagged for review?
   */
  needsReview(): boolean {
    if (this.status === SymbolStatus.PENDING_REVIEW) {
      return true;
    }

    // If streaming but not active on exchange, needs review
    if (this.isStreaming && this.exchangeMetadata) {
      return !isSymbolActiveOnExchange(this.exchangeMetadata);
    }

    return false;
  }

  /**
   * Domain logic: Mark as delisted
   */
  markAsDelisted(): void {
    this.status = SymbolStatus.DELISTED;
    this.delistedAt = new Date();
    this.isStreaming = false;
    this.isProcessing = false;
    this.updatedAt = new Date();
  }

  /**
   * Domain logic: Activate symbol
   */
  activate(): void {
    if (!this.canActivate()) {
      throw new Error(
        `Cannot activate symbol ${this.symbol}: preconditions not met`
      );
    }
    this.status = SymbolStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  /**
   * Domain logic: Update from exchange sync
   * Works with any exchange by updating exchangeMetadata
   */
  updateFromExchangeSync(
    exchangeMetadata: ExchangeMetadata,
    config?: Partial<SymbolConfig>
  ): void {
    this.exchangeMetadata = exchangeMetadata;
    this.lastSyncAt = new Date();

    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.updatedAt = new Date();
  }

  /**
   * Domain logic: Update streaming status
   */
  updateStreamingStatus(isStreaming: boolean): void {
    this.isStreaming = isStreaming;
    this.updatedAt = new Date();
  }

  /**
   * Domain logic: Update processing status
   */
  updateProcessingStatus(isProcessing: boolean): void {
    this.isProcessing = isProcessing;
    this.updatedAt = new Date();
  }

  /**
   * Convert to plain object for persistence
   */
  toJSON() {
    return {
      id: this.id,
      symbol: this.symbol,
      exchange: this.exchange,
      config: this.config,
      status: this.status,
      isStreaming: this.isStreaming,
      isProcessing: this.isProcessing,
      exchangeMetadata: this.exchangeMetadata,
      enabledByAdmin: this.enabledByAdmin,
      delistedAt: this.delistedAt,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastSyncAt: this.lastSyncAt,
    };
  }

  /**
   * Create from plain object
   */
  static fromJSON(data: any): Symbol {
    return new Symbol(
      data.id,
      data.symbol,
      data.exchange,
      data.config,
      data.status,
      data.isStreaming,
      data.isProcessing,
      data.exchangeMetadata,
      data.enabledByAdmin,
      data.delistedAt ? new Date(data.delistedAt) : undefined,
      data.notes,
      new Date(data.createdAt),
      new Date(data.updatedAt),
      new Date(data.lastSyncAt)
    );
  }
}
