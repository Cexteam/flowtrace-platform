/**
 * ProcessTradeUseCase
 *
 * Processes a trade and updates candles across all timeframes.
 * Detects candle completions and triggers rollups.
 * Detects gaps in trade sequence and persists gap records.
 *
 * Ported from cm_sync_candle/src/exchange_crypto/utils/conf_candle.ts
 * Uses lodash cloneDeep before passing to UpdatedGroupCandles to match original flow.
 *
 */

import { injectable, inject, optional } from 'inversify';
import _ from 'lodash';
import {
  ProcessTradeRequest,
  ProcessTradeResult,
  GapDetectionResult,
} from './DTO.js';
import { CandleStoragePort } from '../../ports/out/CandleStoragePort.js';
import { EventPublisherPort } from '../../ports/out/EventPublisherPort.js';
import { GapPersistencePort } from '../../ports/out/GapPersistencePort.js';
import {
  Timeframe,
  FootprintCandle,
  shouldComplete,
  calculateCompletionTime,
  rollup,
} from '../../../domain/index.js';
import { CANDLE_PROCESSING_TYPES } from '../../../../../shared/lib/di/core/types.js';
import { createLogger } from '../../../../../shared/lib/logger/logger.js';

const logger = createLogger('ProcessTradeUseCase');

/**
 * ProcessTradeUseCase
 * Handles the processing of a single trade with gap detection
 */
@injectable()
export class ProcessTradeUseCase {
  private hasLoggedGapPersistenceStatus = false;

  constructor(
    @inject(CANDLE_PROCESSING_TYPES.CandleStoragePort)
    private storage: CandleStoragePort,
    @inject(CANDLE_PROCESSING_TYPES.EventPublisherPort)
    private publisher: EventPublisherPort,
    @inject(CANDLE_PROCESSING_TYPES.GapPersistencePort)
    @optional()
    private gapPersistence?: GapPersistencePort
  ) {}

  /**
   * Execute the use case
   *
   * Matches original flow from cm_sync_candle:
   * 1. Check if 1s candle should complete (opentime !== current)
   * 2. If complete: mark x=true, call UpdatedGroupCandles with timeCheck
   * 3. Reset 1s candle for new period
   * 4. Apply trade to 1s candle
   *
   * Gap detection (moved from BinanceWebSocketAdapter):
   * - Get lastTradeId from CandleGroup.getOneSecondCandle().ls
   * - Compare trade.tradeId with lastTradeId
   * - Detect gap when trade.tradeId > lastTradeId + 1
   * - Handle first trade case (lastTradeId = 0 means no previous trade)
   *
   * Uses _.cloneDeep() before passing to UpdatedGroupCandles to match original.
   * Passes trade.timestamp (equivalent to trade.T) as timeCheck parameter.
   *
   * @param request - Trade processing request
   * @returns Processing result with gap detection info
   *
   */
  async execute(request: ProcessTradeRequest): Promise<ProcessTradeResult> {
    const startTime = Date.now();
    const { trade, config } = request;
    const completedCandles: FootprintCandle[] = [];
    let gapDetected: GapDetectionResult | undefined;

    // Get or initialize candle group
    let candleGroup = await this.storage.getCandleGroup(config.symbol);
    if (!candleGroup) {
      candleGroup = await this.storage.initializeCandleGroup(
        config.symbol,
        config
      );
    }

    // Get the 1-second candle (base candle for trade processing)
    const oneSecondCandle = candleGroup.getOneSecondCandle();

    // ============ Gap Detection ============
    // Gap detection runs for ALL trades (regardless of trade type)
    // This ensures lastTradeId tracking is accurate
    if (trade.tradeId !== undefined) {
      const lastTradeId = oneSecondCandle.ls;

      // Log gap persistence status once per instance
      if (!this.hasLoggedGapPersistenceStatus) {
        logger.debug('Gap persistence status', {
          symbol: config.symbol,
          gapPersistenceAvailable: !!this.gapPersistence,
          lastTradeId,
        });
        this.hasLoggedGapPersistenceStatus = true;
      }

      // lastTradeId = 0 means no previous trade (first trade for this symbol)
      // In this case, accept the trade as baseline - no gap detection needed
      if (lastTradeId > 0) {
        const expectedTradeId = lastTradeId + 1;

        if (trade.tradeId > expectedTradeId) {
          const gapSize = trade.tradeId - expectedTradeId;
          gapDetected = {
            detected: true,
            symbol: config.symbol,
            fromTradeId: expectedTradeId,
            toTradeId: trade.tradeId - 1,
            gapSize,
            detectedAt: Date.now(),
          };

          logger.warn('Gap detected!', {
            symbol: config.symbol,
            lastTradeId,
            newTradeId: trade.tradeId,
            expectedTradeId,
            gapSize,
            gapPersistenceAvailable: !!this.gapPersistence,
          });

          if (this.gapPersistence) {
            // Fire-and-forget: Don't await to avoid blocking trade processing
            // Gap persistence is non-critical, errors are logged but don't affect trade flow
            this.gapPersistence
              .saveGap({
                exchange: config.exchange,
                symbol: config.symbol,
                fromTradeId: expectedTradeId,
                toTradeId: trade.tradeId - 1,
                gapSize,
                detectedAt: Date.now(),
              })
              .catch((error) => {
                logger.error('Failed to persist gap record', {
                  symbol: config.symbol,
                  error: error instanceof Error ? error.message : String(error),
                });
              });
          }
        }
      }

      // Always update lastTradeId for ALL trades (not just MARKET)
      // This is critical for accurate gap detection
      oneSecondCandle.ls = trade.tradeId;
    }

    // ============ Footprint Processing ============
    // Only process valid MARKET trades for footprint calculation
    // Skip trades with price=0 or quantity=0 (e.g., X=NA metadata trades)
    const isMarketTrade = !trade.tradeType || trade.tradeType === 'MARKET';
    const hasValidPriceQuantity = trade.price > 0 && trade.quantity > 0;

    if (!isMarketTrade || !hasValidPriceQuantity) {
      // Non-MARKET or invalid trade: save state (with updated lastTradeId) but skip footprint
      await this.storage.saveCandleGroup(config.symbol, candleGroup);
      return {
        success: true,
        candleGroup,
        completedCandles: [],
        processingTimeMs: Date.now() - startTime,
        gapDetected,
      };
    }

    // Check if 1s candle should complete before applying new trade
    // Matches original: check if opentime !== current candle time
    if (shouldComplete(oneSecondCandle, trade.timestamp)) {
      // Mark current candle as complete (x = true)
      const completionTime = calculateCompletionTime(
        oneSecondCandle.t,
        Timeframe.oneSecond()
      );
      oneSecondCandle.markComplete(completionTime);

      // Clone completed candle before rollup
      const completedOneSecond = oneSecondCandle.clone();
      completedCandles.push(completedOneSecond);

      // Publish completion event
      await this.publisher.publishCandleComplete(completedOneSecond);

      // Roll up to higher timeframes using UpdatedGroupCandles
      // Use _.cloneDeep() before passing to match original flow
      // Pass trade.timestamp (equivalent to trade.T) as timeCheck parameter
      const clonedCandleGroup = _.cloneDeep(candleGroup);
      const clonedCompletedCandle = _.cloneDeep(completedOneSecond);
      const rollupResult = rollup(
        clonedCandleGroup,
        clonedCompletedCandle,
        trade.timestamp // timeCheck parameter - trade time
      );
      candleGroup = rollupResult.candleGroup;

      // Publish any higher timeframe completions
      for (const completed of rollupResult.completedCandles) {
        completedCandles.push(completed);
        await this.publisher.publishCandleComplete(completed);
      }

      // Reset 1s candle for new period
      const newOneSecond = FootprintCandle.createEmpty(
        config.symbol,
        Timeframe.oneSecond(),
        config.tickValue,
        config.exchange
      );

      candleGroup.setCandle(Timeframe.oneSecond(), newOneSecond);
    }

    // Apply trade to 1s candle
    const currentOneSecond = candleGroup.getOneSecondCandle();
    currentOneSecond.applyTrade(trade, config.tickValue);

    // Save updated candle group
    await this.storage.saveCandleGroup(config.symbol, candleGroup);

    return {
      success: true,
      candleGroup,
      completedCandles,
      processingTimeMs: Date.now() - startTime,
      gapDetected,
    };
  }
}
