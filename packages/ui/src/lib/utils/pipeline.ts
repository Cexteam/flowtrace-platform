/**
 * Pipeline Status Utility Functions
 *
 * Functions for deriving pipeline status from symbol properties.
 *
 * Requirements: 2.6, 3.3
 */

/**
 * Pipeline status type
 */
export type PipelineStatus = 'Running' | 'Stopped';

/**
 * Symbol interface for pipeline status derivation
 */
export interface PipelineSymbol {
  status: 'active' | 'inactive' | string;
  enabledByAdmin: boolean;
}

/**
 * Get the pipeline status for a symbol
 *
 * A symbol is "Running" in the pipeline if and only if:
 * - status equals "active" AND
 * - enabledByAdmin equals true
 *
 * Otherwise, the pipeline status is "Stopped".
 *
 * @param symbol - Symbol object with status and enabledByAdmin properties
 * @returns "Running" if both conditions are met, "Stopped" otherwise
 *
 * Requirements: 2.6, 3.3
 */
export function getPipelineStatus(symbol: PipelineSymbol): PipelineStatus {
  const isActive = symbol.status === 'active';
  const isEnabledByAdmin = symbol.enabledByAdmin === true;

  return isActive && isEnabledByAdmin ? 'Running' : 'Stopped';
}

/**
 * Check if a symbol is running in the pipeline
 *
 * Convenience function that returns a boolean instead of status string.
 *
 * @param symbol - Symbol object with status and enabledByAdmin properties
 * @returns True if the symbol is running in the pipeline
 */
export function isSymbolRunning(symbol: PipelineSymbol): boolean {
  return getPipelineStatus(symbol) === 'Running';
}

/**
 * Get pipeline status with additional context
 *
 * Returns the status along with the reason why it's stopped (if applicable).
 *
 * @param symbol - Symbol object with status and enabledByAdmin properties
 * @returns Object with status and optional reason
 */
export function getPipelineStatusWithReason(symbol: PipelineSymbol): {
  status: PipelineStatus;
  reason?: string;
} {
  const isActive = symbol.status === 'active';
  const isEnabledByAdmin = symbol.enabledByAdmin === true;

  if (isActive && isEnabledByAdmin) {
    return { status: 'Running' };
  }

  // Determine the reason for being stopped
  const reasons: string[] = [];
  if (!isActive) {
    reasons.push('Symbol is inactive');
  }
  if (!isEnabledByAdmin) {
    reasons.push('Disabled by admin');
  }

  return {
    status: 'Stopped',
    reason: reasons.join('; '),
  };
}
