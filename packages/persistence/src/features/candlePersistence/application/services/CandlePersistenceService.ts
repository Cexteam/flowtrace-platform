/**
 * CandlePersistenceService
 * Application service that coordinates use cases for candle persistence.
 * Implements the CandlePersistencePort inbound port.
 */

import { injectable, inject } from 'inversify';
import type {
  CandlePersistencePort,
  PersistCandleRequest,
  PersistCandleResult,
} from '../ports/in/CandlePersistencePort.js';
import type { PersistCandleUseCase } from '../use-cases/PersistCandle/PersistCandleUseCase.js';
import { CANDLE_PERSISTENCE_TYPES } from '../../di/types.js';

@injectable()
export class CandlePersistenceService implements CandlePersistencePort {
  constructor(
    @inject(CANDLE_PERSISTENCE_TYPES.PersistCandleUseCase)
    private persistCandleUseCase: PersistCandleUseCase
  ) {}

  async persistCandle(
    request: PersistCandleRequest
  ): Promise<PersistCandleResult> {
    return this.persistCandleUseCase.execute(request);
  }
}
