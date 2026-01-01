/**
 * LoadGapsUseCase
 * Use case for loading gap records from storage.
 */

import { injectable, inject } from 'inversify';
import type { LoadGapsRequest, LoadGapsResult } from './DTO.js';
import type { GapStoragePort } from '../../ports/out/GapStoragePort.js';
import { STATE_PERSISTENCE_TYPES } from '../../../di/types.js';
import { LOGGER_TYPES } from '../../../../../infrastructure/logger/di/module.js';

@injectable()
export class LoadGapsUseCase {
  constructor(
    @inject(STATE_PERSISTENCE_TYPES.GapStoragePort)
    private storage: GapStoragePort,
    @inject(LOGGER_TYPES.Logger)
    private logger: any
  ) {}

  /**
   * Execute gap load
   */
  async execute(request: LoadGapsRequest): Promise<LoadGapsResult> {
    const { options } = request;

    this.logger.debug('Loading gaps', { options });

    const gaps = await this.storage.load(options);

    this.logger.debug('Gaps loaded', { count: gaps.length });

    return {
      success: true,
      gaps,
      loadedAt: Date.now(),
    };
  }
}
