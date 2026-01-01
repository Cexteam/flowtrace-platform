/**
 * SaveStateUseCase
 * Use case for saving CandleGroup states to storage.
 * Validates state data before persisting.
 */

import { injectable, inject } from 'inversify';
import type {
  SaveStateRequest,
  SaveStateResult,
  SaveStateBatchRequest,
  SaveStateBatchResult,
} from './DTO.js';
import type { StateStoragePort } from '../../ports/out/StateStoragePort.js';
import { StateValidator } from '../../../domain/validation/StateValidator.js';
import { STATE_PERSISTENCE_TYPES } from '../../../di/types.js';
import { LOGGER_TYPES } from '../../../../../infrastructure/logger/di/module.js';

@injectable()
export class SaveStateUseCase {
  constructor(
    @inject(STATE_PERSISTENCE_TYPES.StateStoragePort)
    private storage: StateStoragePort,
    @inject(LOGGER_TYPES.Logger)
    private logger: any
  ) {}

  /**
   * Execute single state save
   */
  async execute(request: SaveStateRequest): Promise<SaveStateResult> {
    const { exchange, symbol, stateJson } = request;

    // Validate state data
    const validation = StateValidator.validate(symbol, stateJson);
    if (!validation.valid) {
      this.logger.error('Invalid state data', {
        exchange,
        symbol,
        errors: validation.errors,
      });
      throw new Error(`Invalid state: ${validation.errors.join(', ')}`);
    }

    // Persist to storage
    await this.storage.save(exchange, symbol, stateJson);

    this.logger.debug('State saved', { exchange, symbol });

    return {
      success: true,
      symbol,
      savedAt: Date.now(),
    };
  }

  /**
   * Execute batch state save
   */
  async executeBatch(
    request: SaveStateBatchRequest
  ): Promise<SaveStateBatchResult> {
    const { states } = request;

    // Validate all states
    for (const state of states) {
      const validation = StateValidator.validate(state.symbol, state.stateJson);
      if (!validation.valid) {
        this.logger.error('Invalid state data in batch', {
          exchange: state.exchange,
          symbol: state.symbol,
          errors: validation.errors,
        });
        throw new Error(
          `Invalid state for ${state.symbol}: ${validation.errors.join(', ')}`
        );
      }
    }

    // Persist to storage
    await this.storage.saveBatch(states);

    this.logger.debug('State batch saved', { count: states.length });

    return {
      success: true,
      count: states.length,
      savedAt: Date.now(),
    };
  }
}
