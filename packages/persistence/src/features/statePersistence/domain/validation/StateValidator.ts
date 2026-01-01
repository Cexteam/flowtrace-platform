/**
 * StateValidator
 * Validates state data integrity before persistence.
 * Ensures symbol and stateJson are valid.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class StateValidator {
  /**
   * Validate state data integrity
   *
   * Validates:
   * - Symbol is non-empty string
   * - StateJson is non-empty string
   * - StateJson is valid JSON
   */
  static validate(symbol: string, stateJson: string): ValidationResult {
    const errors: string[] = [];

    // Symbol validation
    if (!symbol || typeof symbol !== 'string') {
      errors.push('Symbol is required and must be a string');
    } else if (symbol.trim() === '') {
      errors.push('Symbol cannot be empty');
    }

    // StateJson validation
    if (!stateJson || typeof stateJson !== 'string') {
      errors.push('StateJson is required and must be a string');
    } else if (stateJson.trim() === '') {
      errors.push('StateJson cannot be empty');
    } else {
      // Validate JSON structure
      try {
        JSON.parse(stateJson);
      } catch {
        errors.push('StateJson must be valid JSON');
      }
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
  static validateOrThrow(symbol: string, stateJson: string): void {
    const result = this.validate(symbol, stateJson);
    if (!result.valid) {
      throw new StateValidationError(
        `Invalid state data: ${result.errors.join(', ')}`,
        result.errors
      );
    }
  }
}

/**
 * Custom error for state validation failures
 */
export class StateValidationError extends Error {
  constructor(message: string, public readonly validationErrors: string[]) {
    super(message);
    this.name = 'StateValidationError';
    Object.setPrototypeOf(this, StateValidationError.prototype);
  }
}
