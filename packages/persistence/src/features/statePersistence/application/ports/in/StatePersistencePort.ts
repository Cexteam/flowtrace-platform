/**
 * StatePersistencePort - Inbound port for state persistence operations
 * Defines the interface for state persistence operations that can be invoked
 * by external actors (handlers, controllers). This is the primary entry point
 * for state persistence functionality.
 */

import type { StateEntry } from '../out/StateStoragePort.js';

/**
 * Request for saving a single state
 */
export interface SaveStateRequest {
  exchange: string;
  symbol: string;
  stateJson: string;
}

/**
 * Request for saving multiple states
 */
export interface SaveStateBatchRequest {
  states: StateEntry[];
}

/**
 * Request for loading a single state
 */
export interface LoadStateRequest {
  exchange: string;
  symbol: string;
}

/**
 * Request for loading multiple states
 */
export interface LoadStateBatchRequest {
  exchange: string;
  symbols: string[];
}

/**
 * Result of a single state load operation
 */
export interface LoadStateResult {
  stateJson: string | null;
}

/**
 * Result of a batch state load operation
 */
export interface LoadStateBatchResult {
  states: StateEntry[];
}

/**
 * Result of loading all states
 */
export interface LoadAllStatesResult {
  states: StateEntry[];
}

/**
 * Inbound port for state persistence operations
 */
export interface StatePersistencePort {
  /**
   * Save a single CandleGroup state
   *
   * @param request - Save state request
   */
  saveState(request: SaveStateRequest): Promise<void>;

  /**
   * Save multiple CandleGroup states in a single transaction
   *
   * @param request - Save state batch request
   */
  saveStateBatch(request: SaveStateBatchRequest): Promise<void>;

  /**
   * Load a single CandleGroup state
   *
   * @param request - Load state request
   * @returns Load state result with stateJson or null
   */
  loadState(request: LoadStateRequest): Promise<LoadStateResult>;

  /**
   * Load states for specific symbols
   *
   * @param request - Load state batch request
   * @returns Load state batch result with states array
   */
  loadStateBatch(request: LoadStateBatchRequest): Promise<LoadStateBatchResult>;

  /**
   * Load all persisted CandleGroup states
   *
   * @returns Load all states result with states array
   */
  loadAllStates(): Promise<LoadAllStatesResult>;
}
