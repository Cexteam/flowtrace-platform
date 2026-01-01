/**
 * LoadStateUseCase
 * Use case for loading CandleGroup states from storage.
 */

import { injectable, inject } from 'inversify';
import type {
  LoadStateRequest,
  LoadStateResult,
  LoadStateBatchRequest,
  LoadStateBatchResult,
  LoadAllStatesResult,
} from './DTO.js';
import type { StateStoragePort } from '../../ports/out/StateStoragePort.js';
import { STATE_PERSISTENCE_TYPES } from '../../../di/types.js';
import { LOGGER_TYPES } from '../../../../../infrastructure/logger/di/module.js';

@injectable()
export class LoadStateUseCase {
  constructor(
    @inject(STATE_PERSISTENCE_TYPES.StateStoragePort)
    private storage: StateStoragePort,
    @inject(LOGGER_TYPES.Logger)
    private logger: any
  ) {}

  /**
   * Execute single state load
   */
  async execute(request: LoadStateRequest): Promise<LoadStateResult> {
    const { exchange, symbol } = request;

    this.logger.debug('Loading state', { exchange, symbol });

    const stateJson = await this.storage.load(exchange, symbol);

    this.logger.debug('State loaded', {
      exchange,
      symbol,
      found: stateJson !== null,
    });

    return {
      success: true,
      symbol,
      stateJson,
      loadedAt: Date.now(),
    };
  }

  /**
   * Execute batch state load
   */
  async executeBatch(
    request: LoadStateBatchRequest
  ): Promise<LoadStateBatchResult> {
    const { exchange, symbols } = request;

    this.logger.debug('Loading state batch', {
      exchange,
      count: symbols.length,
    });

    const states = await this.storage.loadBatch(exchange, symbols);

    this.logger.debug('State batch loaded', {
      exchange,
      requested: symbols.length,
      found: states.length,
    });

    return {
      success: true,
      states,
      loadedAt: Date.now(),
    };
  }

  /**
   * Execute load all states
   */
  async executeAll(): Promise<LoadAllStatesResult> {
    this.logger.debug('Loading all states');

    const states = await this.storage.loadAll();

    this.logger.debug('All states loaded', { count: states.length });

    return {
      success: true,
      states,
      loadedAt: Date.now(),
    };
  }
}
