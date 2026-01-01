/**
 * CandleProcessingService
 *
 * Application service that implements CandleProcessingPort.
 * Orchestrates use cases without containing business logic.
 *
 */

import { injectable, inject } from 'inversify';
import {
  CandleProcessingPort,
  ProcessTradeRequest,
  ProcessTradeResult,
  InitializeSymbolRequest,
} from '../ports/in/CandleProcessingPort.js';
import { CandleStoragePort } from '../ports/out/CandleStoragePort.js';
import { CandleGroup } from '../../domain/entities/CandleGroup.js';
import { ProcessTradeUseCase } from '../use-cases/ProcessTrade/ProcessTradeUseCase.js';
import { InitializeSymbolUseCase } from '../use-cases/InitializeSymbol/InitializeSymbolUseCase.js';
import { CANDLE_PROCESSING_TYPES } from '../../../../shared/lib/di/core/types.js';

/**
 * CandleProcessingService
 * Implements CandleProcessingPort and delegates to use cases
 */
@injectable()
export class CandleProcessingService implements CandleProcessingPort {
  constructor(
    // Inject use cases via DI
    @inject(CANDLE_PROCESSING_TYPES.ProcessTradeUseCase)
    private processTradeUseCase: ProcessTradeUseCase,

    @inject(CANDLE_PROCESSING_TYPES.InitializeSymbolUseCase)
    private initializeUseCase: InitializeSymbolUseCase,

    // Can also inject ports for simple queries
    @inject(CANDLE_PROCESSING_TYPES.CandleStoragePort)
    private storage: CandleStoragePort
  ) {}

  /**
   * Process a trade - delegates to ProcessTradeUseCase
   * NO business logic here, just delegation
   */
  async processTrade(
    request: ProcessTradeRequest
  ): Promise<ProcessTradeResult> {
    return this.processTradeUseCase.execute(request);
  }

  /**
   * Initialize a symbol - delegates to InitializeSymbolUseCase
   * NO business logic here, just delegation
   */
  async initializeSymbol(request: InitializeSymbolRequest): Promise<void> {
    return this.initializeUseCase.execute(request);
  }

  /**
   * Get candle group - simple query uses port directly
   */
  async getCandleGroup(symbol: string): Promise<CandleGroup | null> {
    return this.storage.getCandleGroup(symbol);
  }
}
