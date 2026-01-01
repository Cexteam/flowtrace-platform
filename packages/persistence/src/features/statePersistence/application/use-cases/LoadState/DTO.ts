/**
 * Data Transfer Objects for LoadState use case
 */

/**
 * Request for loading a single state
 */
export interface LoadStateRequest {
  exchange: string;
  symbol: string;
}

/**
 * Result of loading a single state
 */
export interface LoadStateResult {
  success: boolean;
  symbol: string;
  stateJson: string | null;
  loadedAt: number;
}

/**
 * Request for loading multiple states
 */
export interface LoadStateBatchRequest {
  exchange: string;
  symbols: string[];
}

/**
 * Result of loading multiple states
 */
export interface LoadStateBatchResult {
  success: boolean;
  states: Array<{
    exchange: string;
    symbol: string;
    stateJson: string;
  }>;
  loadedAt: number;
}

/**
 * Result of loading all states
 */
export interface LoadAllStatesResult {
  success: boolean;
  states: Array<{
    exchange: string;
    symbol: string;
    stateJson: string;
  }>;
  loadedAt: number;
}
