/**
 * CandleProcessing Shared Bindings
 *
 * Runtime-agnostic bindings for CandleProcessing feature.
 * These bindings are used by both main and worker threads.
 *
 * Services bound here:
 * - ProcessTradeUseCase: Application use case for processing trades
 * - InitializeSymbolUseCase: Application use case for initializing symbols
 * - CandleProcessingService: Main application service
 *
 */

import { Container } from 'inversify';
import { CANDLE_PROCESSING_TYPES } from './types.js';

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
