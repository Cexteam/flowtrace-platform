/**
 * PersistCandleUseCase
 * Use case for persisting completed candles to storage.
 * Validates candle data before persisting.
 */

import { injectable, inject } from 'inversify';
import type { PersistCandleRequest, PersistCandleResult } from './DTO.js';
import type { CandleStoragePort } from '../../ports/out/CandleStoragePort.js';
import { CandleValidator } from '../../../domain/validation/CandleValidator.js';
import { CANDLE_PERSISTENCE_TYPES } from '../../../di/types.js';
import { LOGGER_TYPES } from '../../../../../infrastructure/logger/di/module.js';

@injectable()
export class PersistCandleUseCase {
  constructor(
    @inject(CANDLE_PERSISTENCE_TYPES.CandleStoragePort)
    private storage: CandleStoragePort,
    @inject(LOGGER_TYPES.Logger)
    private logger: any
  ) {}

  async execute(request: PersistCandleRequest): Promise<PersistCandleResult> {
    const { candle, source, messageId } = request;

    // Skip 1s candles - only persist 1m and above
    if (candle.i === '1s') {
      return {
        success: true,
        candleId: `${candle.ex}:${candle.s}:${candle.i}:${candle.t}`,
        persistedAt: Date.now(),
      };
    }

    // Validate candle data
    const validation = CandleValidator.validate(candle);
    if (!validation.valid) {
      this.logger.error('Invalid candle data', {
        source,
        messageId,
        errors: validation.errors,
        symbol: candle.s,
        timeframe: candle.i,
      });
      throw new Error(`Invalid candle: ${validation.errors.join(', ')}`);
    }

    // Persist to storage
    await this.storage.save(candle);

    return {
      success: true,
      candleId: `${candle.ex}:${candle.s}:${candle.i}:${candle.t}`,
      persistedAt: Date.now(),
    };
  }
}
