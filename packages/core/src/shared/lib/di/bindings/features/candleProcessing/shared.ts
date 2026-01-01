/**
 * CandleProcessing Shared Bindings
 *
 * Runtime-agnostic bindings for CandleProcessing feature.
 * These bindings are used by both main and worker threads.
 *
 * Services bound here:
 * - FootprintCalculator: Pure function service for footprint calculations
 * - TimeframeRollup: Pure function service for timeframe rollup
 * - ProcessTradeUseCase: Application use case for processing trades
 * - InitializeSymbolUseCase: Application use case for initializing symbols
 * - CandleProcessingService: Main application service
 *
 */

import { Container } from 'inversify';
import { CANDLE_PROCESSING_TYPES } from './types.js';

// Domain Services
import { FootprintCalculator } from '../../../../../../features/candleProcessing/domain/services/FootprintCalculator.js';
import { TimeframeRollup } from '../../../../../../features/candleProcessing/domain/services/TimeframeRollup.js';

// Application Layer - Use Cases
import { ProcessTradeUseCase } from '../../../../../../features/candleProcessing/application/use-cases/ProcessTrade/ProcessTradeUseCase.js';
import { InitializeSymbolUseCase } from '../../../../../../features/candleProcessing/application/use-cases/InitializeSymbol/InitializeSymbolUseCase.js';

// Application Layer - Services
import { CandleProcessingService } from '../../../../../../features/candleProcessing/application/services/CandleProcessingService.js';
import { CandleProcessingPort } from '../../../../../../features/candleProcessing/application/ports/in/CandleProcessingPort.js';

/**
 * Configure shared CandleProcessing bindings
 * These bindings are the same for both main and worker threads
 *
 * @param container - InversifyJS container
 */
export function configureCandleProcessingShared(container: Container): void {
  // Domain Services (pure functions, stateless)
  container
    .bind(CANDLE_PROCESSING_TYPES.FootprintCalculator)
    .to(FootprintCalculator)
    .inSingletonScope();

  container
    .bind(CANDLE_PROCESSING_TYPES.TimeframeRollup)
    .to(TimeframeRollup)
    .inSingletonScope();

  // Application Use Cases
  container
    .bind(CANDLE_PROCESSING_TYPES.ProcessTradeUseCase)
    .to(ProcessTradeUseCase)
    .inSingletonScope();

  container
    .bind(CANDLE_PROCESSING_TYPES.InitializeSymbolUseCase)
    .to(InitializeSymbolUseCase)
    .inSingletonScope();

  // Application Service (implements CandleProcessingPort)
  container
    .bind<CandleProcessingPort>(CANDLE_PROCESSING_TYPES.CandleProcessingPort)
    .to(CandleProcessingService)
    .inSingletonScope();

  container
    .bind(CANDLE_PROCESSING_TYPES.CandleProcessingService)
    .to(CandleProcessingService)
    .inSingletonScope();
}
