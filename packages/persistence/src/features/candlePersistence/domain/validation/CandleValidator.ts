/**
 * CandleValidator
 * Validates candle data integrity before persistence.
 * Ensures OHLC consistency, volume/delta consistency, and timestamp validity.
 */

import { FootprintCandle } from '@flowtrace/core';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class CandleValidator {
  /**
   * Validate candle data integrity
   *
   * Validates:
   * - Required fields (symbol, exchange, timeframe)
   * - Timestamp validity (positive values, close >= open)
   * - OHLC consistency (high >= low, open/close within range)
   * - Volume consistency (non-negative, buy + sell = total)
   * - Delta consistency (delta = buy - sell)
   */
  static validate(candle: FootprintCandle): ValidationResult {
    const errors: string[] = [];

    // Required fields validation
    if (!candle.s || candle.s.trim() === '') {
      errors.push('Symbol is required');
    }
    if (!candle.ex || candle.ex.trim() === '') {
      errors.push('Exchange is required');
    }
    if (!candle.i || candle.i.trim() === '') {
      errors.push('Timeframe is required');
    }

    // Timestamp validation
    if (candle.t <= 0) {
      errors.push('Open time must be positive');
    }
    if (candle.ct < 0) {
      errors.push('Close time must be non-negative');
    }
    if (candle.ct > 0 && candle.ct < candle.t) {
      errors.push('Close time must be >= open time');
    }

    // OHLC validation
    if (candle.h < candle.l) {
      errors.push('High must be >= low');
    }
    if (candle.o < candle.l || candle.o > candle.h) {
      errors.push('Open must be between low and high');
    }
    if (candle.c < candle.l || candle.c > candle.h) {
      errors.push('Close must be between low and high');
    }

    // Volume validation
    if (candle.v < 0) {
      errors.push('Volume must be non-negative');
    }
    if (candle.bv < 0) {
      errors.push('Buy volume must be non-negative');
    }
    if (candle.sv < 0) {
      errors.push('Sell volume must be non-negative');
    }

    // Volume consistency: v = bv + sv (with floating point tolerance)
    const volumeSum = parseFloat((candle.bv + candle.sv).toFixed(8));
    const volumeDiff = Math.abs(candle.v - volumeSum);
    if (volumeDiff > 0.00000001) {
      // Tolerance for floating point precision
      errors.push(
        `Volume must equal buy volume + sell volume (expected: ${volumeSum}, got: ${candle.v})`
      );
    }

    // Delta validation: d = bv - sv (with floating point tolerance)
    const expectedDelta = parseFloat((candle.bv - candle.sv).toFixed(8));
    const deltaDiff = Math.abs(candle.d - expectedDelta);
    if (deltaDiff > 0.00000001) {
      // Tolerance for floating point precision
      errors.push(
        `Delta must equal buy volume - sell volume (expected: ${expectedDelta}, got: ${candle.d})`
      );
    }

    // Quote volume validation
    if (candle.q < 0) {
      errors.push('Quote volume must be non-negative');
    }
    if (candle.bq < 0) {
      errors.push('Buy quote volume must be non-negative');
    }
    if (candle.sq < 0) {
      errors.push('Sell quote volume must be non-negative');
    }

    // Trade count validation
    if (candle.n < 0) {
      errors.push('Number of trades must be non-negative');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate and throw if invalid
   * Convenience method for use cases that want to fail fast
   */
  static validateOrThrow(candle: FootprintCandle): void {
    const result = this.validate(candle);
    if (!result.valid) {
      throw new ValidationError(
        `Invalid candle data: ${result.errors.join(', ')}`,
        result.errors
      );
    }
  }
}

/**
 * Custom error for validation failures
 */
export class ValidationError extends Error {
  constructor(message: string, public readonly validationErrors: string[]) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
