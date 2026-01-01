/**
 * RuntimeStateStorageAdapter - Implements StateStoragePort using RuntimeDatabase
 * Provides state storage operations using the RuntimeDatabase from @flowtrace/ipc.
 */

import { injectable, inject } from 'inversify';
import type { RuntimeDB } from '@flowtrace/ipc';
import type {
  StateStoragePort,
  StateEntry,
} from '../../application/ports/out/StateStoragePort.js';
import { IPC_TYPES } from '../../../../infrastructure/ipc/di/module.js';

/**
 * Adapter that implements StateStoragePort using RuntimeDatabase
 */
@injectable()
export class RuntimeStateStorageAdapter implements StateStoragePort {
  constructor(
    @inject(IPC_TYPES.RuntimeDatabase)
    private readonly runtimeDb: RuntimeDB
  ) {}

  /**
   * Save a single CandleGroup state
   *
   * @param exchange - Exchange name
   * @param symbol - Trading symbol
   * @param stateJson - Serialized CandleGroup JSON
   */
  async save(
    exchange: string,
    symbol: string,
    stateJson: string
  ): Promise<void> {
    this.runtimeDb.saveState(exchange, symbol, stateJson);
  }

  /**
   * Save multiple CandleGroup states in a single transaction
   *
   * @param states - Array of state entries to save
   */
  async saveBatch(states: StateEntry[]): Promise<void> {
    this.runtimeDb.saveStateBatch(states);
  }

  /**
   * Load a single CandleGroup state
   *
   * @param exchange - Exchange name
   * @param symbol - Trading symbol
   * @returns Serialized CandleGroup JSON or null if not found
   */
  async load(exchange: string, symbol: string): Promise<string | null> {
    return this.runtimeDb.loadState(exchange, symbol);
  }

  /**
   * Load states for specific symbols within an exchange
   *
   * @param exchange - Exchange name
   * @param symbols - Array of trading symbols
   * @returns Array of state entries for found symbols
   */
  async loadBatch(exchange: string, symbols: string[]): Promise<StateEntry[]> {
    return this.runtimeDb.loadStatesBatch(exchange, symbols);
  }

  /**
   * Load all persisted CandleGroup states
   *
   * @returns Array of all state entries
   */
  async loadAll(): Promise<StateEntry[]> {
    return this.runtimeDb.loadAllStates();
  }

  /**
   * Load all states for a specific exchange
   *
   * @param exchange - Exchange name
   * @returns Array of state entries for the exchange
   */
  async loadByExchange(exchange: string): Promise<StateEntry[]> {
    return this.runtimeDb.loadStatesByExchange(exchange);
  }
}
