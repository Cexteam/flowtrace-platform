/**
 * SaveGapUseCase
 * Use case for saving gap records to storage.
 * Validates gap data before persisting.
 */

import { injectable, inject } from 'inversify';
import type { SaveGapRequest, SaveGapResult } from './DTO.js';
import type { GapStoragePort } from '../../ports/out/GapStoragePort.js';
import { GapValidator } from '../../../domain/validation/GapValidator.js';
import { STATE_PERSISTENCE_TYPES } from '../../../di/types.js';
import { LOGGER_TYPES } from '../../../../../infrastructure/logger/di/module.js';

@injectable()
export class SaveGapUseCase {
  constructor(
    @inject(STATE_PERSISTENCE_TYPES.GapStoragePort)
    private storage: GapStoragePort,
    @inject(LOGGER_TYPES.Logger)
    private logger: any
  ) {}

  /**
   * Execute gap save
   */
  async execute(request: SaveGapRequest): Promise<SaveGapResult> {
    const { gap } = request;

    // Validate gap data
    const validation = GapValidator.validate(gap);
    if (!validation.valid) {
      this.logger.error('Invalid gap data', {
        symbol: gap.symbol,
        errors: validation.errors,
      });
      throw new Error(`Invalid gap: ${validation.errors.join(', ')}`);
    }

    // Persist to storage
    await this.storage.save(gap);

    this.logger.debug('Gap saved', {
      symbol: gap.symbol,
      fromTradeId: gap.fromTradeId,
      toTradeId: gap.toTradeId,
    });

    return {
      success: true,
      symbol: gap.symbol,
      savedAt: Date.now(),
    };
  }
}
