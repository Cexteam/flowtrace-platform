/**
 * InitializeSymbolUseCase
 *
 * Initializes a symbol for candle processing.
 * Creates candle group and stores symbol configuration.
 * Skips initialization if symbol already exists (preserves restored state).
 *
 */

import { injectable, inject } from 'inversify';
import { InitializeSymbolRequest } from './DTO.js';
import { CandleStoragePort } from '../../ports/out/CandleStoragePort.js';
import { SymbolConfigPort } from '../../ports/out/SymbolConfigPort.js';
import { CANDLE_PROCESSING_TYPES } from '../../../../../shared/lib/di/core/types.js';
import { createLogger } from '../../../../../shared/lib/logger/logger.js';

const logger = createLogger('InitializeSymbolUseCase');

/**
 * InitializeSymbolUseCase
 * Handles symbol initialization for candle processing
 */
@injectable()
export class InitializeSymbolUseCase {
  constructor(
    @inject(CANDLE_PROCESSING_TYPES.CandleStoragePort)
    private storage: CandleStoragePort,
    @inject(CANDLE_PROCESSING_TYPES.SymbolConfigPort)
    private configPort: SymbolConfigPort
  ) {}

  /**
   * Execute the use case
   * @param request - Symbol initialization request
   */
  async execute(request: InitializeSymbolRequest): Promise<void> {
    const { config } = request;

    // Store symbol configuration
    await this.configPort.setConfig(config.symbol, config);

    // Check if symbol already exists (e.g., restored from state persistence)
    const existingGroup = await this.storage.getCandleGroup(config.symbol);
    if (existingGroup) {
      logger.debug(
        'Symbol already initialized, skipping (preserving restored state)',
        {
          symbol: config.symbol,
          timeframes: existingGroup.size,
        }
      );
      return;
    }

    // Initialize candle group (creates all timeframe candles)
    await this.storage.initializeCandleGroup(config.symbol, config);
  }
}
