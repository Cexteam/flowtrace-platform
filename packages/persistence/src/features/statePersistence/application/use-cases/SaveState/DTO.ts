/**
 * Data Transfer Objects for SaveState use case
 */

/**
 * Request for saving a single state
 */
export interface SaveStateRequest {
  exchange: string;
  symbol: string;
  stateJson: string;
}

/**
 * Result of saving a state
 */
export interface SaveStateResult {
  success: boolean;
  symbol: string;
  savedAt: number;
}

/**
 * Request for saving multiple states
 */
export interface SaveStateBatchRequest {
  states: Array<{
    exchange: string;
    symbol: string;
    stateJson: string;
  }>;
}

/**
 * Result of saving multiple states
 */
export interface SaveStateBatchResult {
  success: boolean;
  count: number;
  savedAt: number;
}
