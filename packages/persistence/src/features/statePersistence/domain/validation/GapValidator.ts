/**
 * GapValidator
 * Validates gap record data integrity before persistence.
 * Ensures all required fields are present and valid.
 */

import type { GapRecordInputDTO } from '@flowtrace/ipc';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class GapValidator {
  /**
   * Validate gap record data integrity
   *
   * Validates:
   * - Symbol is non-empty string
   * - FromTradeId is positive number
   * - ToTradeId is positive number
   * - ToTradeId > FromTradeId
   * - GapSize is positive number
   * - DetectedAt is positive timestamp
   */
  static validate(gap: GapRecordInputDTO): ValidationResult {
    const errors: string[] = [];

    // Symbol validation
    if (!gap.symbol || typeof gap.symbol !== 'string') {
      errors.push('Symbol is required and must be a string');
    } else if (gap.symbol.trim() === '') {
      errors.push('Symbol cannot be empty');
    }

    // FromTradeId validation
    if (typeof gap.fromTradeId !== 'number') {
      errors.push('FromTradeId is required and must be a number');
    } else if (gap.fromTradeId < 0) {
      errors.push('FromTradeId must be non-negative');
    }

    // ToTradeId validation
    if (typeof gap.toTradeId !== 'number') {
      errors.push('ToTradeId is required and must be a number');
    } else if (gap.toTradeId < 0) {
      errors.push('ToTradeId must be non-negative');
    }

    // ToTradeId >= FromTradeId validation
    // When gapSize = 1, fromTradeId = toTradeId (only 1 trade missing)
    if (
      typeof gap.fromTradeId === 'number' &&
      typeof gap.toTradeId === 'number' &&
      gap.toTradeId < gap.fromTradeId
    ) {
      errors.push('ToTradeId must be greater than or equal to FromTradeId');
    }

    // GapSize validation
    if (typeof gap.gapSize !== 'number') {
      errors.push('GapSize is required and must be a number');
    } else if (gap.gapSize <= 0) {
      errors.push('GapSize must be positive');
    }

    // DetectedAt validation
    if (typeof gap.detectedAt !== 'number') {
      errors.push('DetectedAt is required and must be a number');
    } else if (gap.detectedAt <= 0) {
      errors.push('DetectedAt must be a positive timestamp');
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
  static validateOrThrow(gap: GapRecordInputDTO): void {
    const result = this.validate(gap);
    if (!result.valid) {
      throw new GapValidationError(
        `Invalid gap data: ${result.errors.join(', ')}`,
        result.errors
      );
    }
  }
}

/**
 * Custom error for gap validation failures
 */
export class GapValidationError extends Error {
  constructor(message: string, public readonly validationErrors: string[]) {
    super(message);
    this.name = 'GapValidationError';
    Object.setPrototypeOf(this, GapValidationError.prototype);
  }
}
