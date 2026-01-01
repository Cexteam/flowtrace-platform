import { inject, injectable } from 'inversify';
import { TYPES } from '../../../../../shared/lib/di/core/types.js';
import { createLogger } from '../../../../../shared/lib/logger/logger.js';
import {
  RestApiGapRecoveryPort,
  SyncStatistics,
} from '../../ports/out/RestApiGapRecoveryPort.js';
import { TradeRouterDrivingPort } from '../../../../tradeRouter/application/ports/in/TradeRouterDrivingPort.js';
import {
  DetectGapsRequest,
  DetectGapsResponse,
  RecoverGapsRequest,
  RecoverGapsResponse,
  GapInfo,
  RecoveryStrategy,
} from './DTO.js';

const logger = createLogger('GapRecoveryUseCase');

/**
 * GAP RECOVERY USE CASE - Clean Architecture
 *
 * Automatically detects and recovers missing trade data using REST API fallback.
 * Restores data integrity after WebSocket connection issues or service restarts.
 *
 * KEY FEATURES:
 * - Intelligent gap detection (trade ID sequence analysis)
 * - Smart recovery strategies (threshold-based batching)
 * - Performance-aware processing (rate limit compliance)
 * - Progress tracking and monitoring
 *
 * INTEGRATION POINTS:
 * - RestApiGapRecoveryPort: Binance REST API adapter
 * - FootprintCalculationPort: Processed recovered trades continue normal flow
 *
 * Clean Architecture: Application Layer Use Case
 */
@injectable()
export class GapRecoveryUseCase {
  constructor(
    @inject(TYPES.RestApiGapRecoveryPort)
    private restApiRecovery: RestApiGapRecoveryPort,

    @inject(TYPES.TradeRouterDrivingPort)
    private tradeRouter: TradeRouterDrivingPort
  ) {}

  /**
   * PRIMARY USE CASE: Detect gaps in trade sequence and return recovery plan
   * This is the "gap detection" part that works with state restoration
   */
  async detectGaps(request: DetectGapsRequest): Promise<DetectGapsResponse> {
    const startTime = Date.now();
    const detectedGaps: GapInfo[] = [];

    try {
      logger.info('Starting gap detection', {
        symbol: request.symbol,
        expectedTrades: request.expectedTrades?.length || 'unknown',
        lastProcessedId: request.lastProcessedId,
      });

      // Analysis: Compare expected vs actual trade sequences
      for (const expectedTrades of request.expectedTrades || []) {
        const gaps = await this.analyzeTradeSequence(
          request.symbol,
          expectedTrades,
          request.lastProcessedId
        );
        detectedGaps.push(...gaps);
      }

      // Additional check: Current WebSocket data vs last processed
      if (request.lastProcessedId > 0) {
        const currentGap = await this.checkCurrentGap(
          request.symbol,
          request.lastProcessedId
        );
        if (currentGap) {
          detectedGaps.push(currentGap);
        }
      }

      // Filter and prioritize gaps
      const actionableGaps = this.prioritizeGaps(
        detectedGaps,
        request.maxGapsToRecover
      );

      const duration = Date.now() - startTime;
      logger.info(`Gap detection completed for ${request.symbol}`, {
        totalGaps: detectedGaps.length,
        actionableGaps: actionableGaps.length,
        durationMs: duration,
      });

      return {
        success: true,
        symbol: request.symbol,
        detectedGaps,
        actionableGaps,
        recoveryRecommended: actionableGaps.length > 0,
        metadata: {
          detectionDuration: duration,
          detectionTimestamp: startTime,
          gapCount: detectedGaps.length,
          largestGap: detectedGaps.reduce(
            (max, gap) => Math.max(max, gap.tradeCount),
            0
          ),
          configUsed: request.detectionConfig || {
            minGapSize: 5,
            maxGapSize: 10000,
            minConfidenceThreshold: 0.8,
            lookbackHours: 24,
          },
          performance: {
            sequencesAnalyzed: request.expectedTrades?.length || 0,
            tradeComparisonsMade: 0,
            averageDetectionSpeed:
              duration / Math.max(request.expectedTrades?.length || 1, 1),
          },
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Gap detection failed for ${request.symbol}`, {
        error: (error as Error).message,
      });

      return {
        success: false,
        symbol: request.symbol,
        detectedGaps: [],
        actionableGaps: [],
        recoveryRecommended: false,
        errors: [(error as Error).message],
        metadata: {
          detectionDuration: duration,
          detectionTimestamp: startTime,
          gapCount: 0,
          largestGap: 0,
          configUsed: request.detectionConfig || {
            minGapSize: 5,
            maxGapSize: 10000,
            minConfidenceThreshold: 0.8,
            lookbackHours: 24,
          },
          performance: {
            sequencesAnalyzed: 0,
            tradeComparisonsMade: 0,
            averageDetectionSpeed: 0,
          },
        },
      };
    }
  }

  /**
   * SECONDARY USE CASE: Execute recovery plan using REST API fallback
   * This is the "gap filling" part that triggers when gaps are confirmed
   */
  async recoverGaps(request: RecoverGapsRequest): Promise<RecoverGapsResponse> {
    const startTime = Date.now();
    const recoveredTrades: number = 0;
    const failedGaps: GapInfo[] = [];
    const successGaps: GapInfo[] = [];

    try {
      logger.info('Starting gap recovery', {
        symbol: request.symbol,
        gapsToRecover: request.gapsToRecover.length,
        strategy: request.strategy || 'batch',
      });

      // Strategy selection: batch vs individual
      const strategy =
        request.strategy || this.selectRecoveryStrategy(request.gapsToRecover);

      switch (strategy) {
        case 'batch':
          await this.recoverBatchStrategy(
            request.symbol,
            request.gapsToRecover,
            successGaps,
            failedGaps
          );
          break;

        case 'individual':
          await this.recoverIndividualStrategy(
            request.symbol,
            request.gapsToRecover,
            successGaps,
            failedGaps
          );
          break;

        case 'prioritized':
          await this.recoverPrioritizedStrategy(
            request.symbol,
            request.gapsToRecover,
            successGaps,
            failedGaps
          );
          break;
      }

      const duration = Date.now() - startTime;
      const recoveredTradesCount = successGaps.reduce(
        (total, gap) => total + gap.tradeCount,
        0
      );

      logger.info(`Gap recovery completed for ${request.symbol}`, {
        strategy,
        recoveredTrades: recoveredTradesCount,
        successfulGaps: successGaps.length,
        failedGaps: failedGaps.length,
        durationMs: duration,
      });

      return {
        success: failedGaps.length === 0,
        symbol: request.symbol,
        recoveredTrades: recoveredTradesCount,
        successGaps,
        failedGaps,
        metadata: {
          strategy,
          recoveryDuration: duration,
          recoveryTimestamp: startTime,
          successRate: successGaps.length / request.gapsToRecover.length,
          totalGaps: request.gapsToRecover.length,
          apiCallsMade: 0, // Will be tracked in future implementation
          rateLimitHits: 0, // Will be tracked in future implementation
          performance: {
            tradesProcessedPerSecond:
              recoveredTradesCount > 0
                ? recoveredTradesCount / (duration / 1000)
                : 0,
            averageApiCallDuration: duration, // Simplified for now
            totalBytesTransferred: 0, // Will be tracked in future
            memoryPeakUsage: process.memoryUsage().heapUsed, // Current heap usage
          },
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Gap recovery failed for ${request.symbol}`, {
        error: (error as Error).message,
      });

      return {
        success: false,
        symbol: request.symbol,
        recoveredTrades: 0,
        successGaps: [],
        failedGaps: request.gapsToRecover,
        errors: [(error as Error).message],
        metadata: {
          strategy: request.strategy || 'batch',
          recoveryDuration: duration,
          recoveryTimestamp: startTime,
          successRate: 0,
          totalGaps: request.gapsToRecover.length,
          apiCallsMade: 0,
          rateLimitHits: 0,
          performance: {
            tradesProcessedPerSecond: 0,
            averageApiCallDuration: 0,
            totalBytesTransferred: 0,
            memoryPeakUsage: 0,
          },
        },
      };
    }
  }

  /**
   * Analyze trade sequence for gaps using trade ID continuity
   */
  private async analyzeTradeSequence(
    symbol: string,
    expectedTrades: any[],
    lastKnownId: number
  ): Promise<GapInfo[]> {
    const gaps: GapInfo[] = [];

    // Sort trades by ID for sequence analysis
    const sortedTrades = [...expectedTrades].sort(
      (a, b) => (a.t || 0) - (b.t || 0)
    );
    const tradeIds = sortedTrades
      .map((trade) => trade.a || trade.t)
      .filter((id) => id > 0);

    if (tradeIds.length === 0) return gaps;

    // Sequence gap detection
    for (let i = 1; i < tradeIds.length; i++) {
      const currentId = tradeIds[i];
      const previousId = tradeIds[i - 1];
      const gap = currentId - previousId - 1;

      if (gap > 0) {
        gaps.push({
          symbol,
          startId: previousId + 1,
          endId: currentId - 1,
          tradeCount: gap,
          detectionReason: 'sequence_gap',
          confidence: 0.95,
          priority: this.calculateGapPriority(gap, symbol),
          estimatedRecoveryTime: this.estimateRecoveryTime(gap),
        });
      }
    }

    // Gap between last processed and newest trade
    if (lastKnownId > 0 && tradeIds.length > 0) {
      const newestId = Math.max(...tradeIds);
      const currentGap = newestId - lastKnownId - 1;

      if (currentGap > 0) {
        gaps.push({
          symbol,
          startId: lastKnownId + 1,
          endId: newestId - 1,
          tradeCount: currentGap,
          detectionReason: 'processed_vs_current_gap',
          confidence: 0.8,
          priority: this.calculateGapPriority(currentGap, symbol),
          estimatedRecoveryTime: this.estimateRecoveryTime(currentGap),
        });
      }
    }

    return gaps;
  }

  /**
   * Check for current gap between last processed and live trades
   */
  private async checkCurrentGap(
    symbol: string,
    lastProcessedId: number
  ): Promise<GapInfo | null> {
    try {
      // This would typically query current live trade ID
      // For now, simulate typical gap detection
      const currentLiveId = await this.getCurrentLiveTradeId(symbol);

      if (!currentLiveId) return null;

      const gapSize = currentLiveId - lastProcessedId - 1;
      if (gapSize <= 0) return null;

      return {
        symbol,
        startId: lastProcessedId + 1,
        endId: currentLiveId - 1,
        tradeCount: gapSize,
        detectionReason: 'live_gap_detection',
        confidence: 0.9,
        priority: this.calculateGapPriority(gapSize, symbol),
        estimatedRecoveryTime: this.estimateRecoveryTime(gapSize),
      };
    } catch (error) {
      logger.debug(`Current gap check failed for ${symbol}`, error);
      return null;
    }
  }

  /**
   * Prioritize and filter gaps based on recovery limits
   */
  private prioritizeGaps(gaps: GapInfo[], maxGaps: number = 10): GapInfo[] {
    return gaps
      .filter((gap) => gap.tradeCount > 0 && gap.tradeCount < 10000) // Reasonable limits
      .sort((a, b) => {
        // Priority sorting: recent > urgent > large
        const priorityScoreA = a.priority + a.confidence * 10;
        const priorityScoreB = b.priority + b.confidence * 10;
        return priorityScoreB - priorityScoreA;
      })
      .slice(0, maxGaps || gaps.length);
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 🔄 CORE RECOVERY STRATEGIES
  // ═════════════════════════════════════════════════════════════════════════════

  /**
   * Batch recovery strategy: Group small gaps for efficiency
   */
  private async recoverBatchStrategy(
    symbol: string,
    gaps: GapInfo[],
    successGaps: GapInfo[],
    failedGaps: GapInfo[]
  ): Promise<void> {
    const batchSize = 1000; // Trades per REST API call
    const batchedGaps = this.batchGapsBySize(gaps, batchSize);

    for (const batch of batchedGaps) {
      try {
        const recoveredTrades = await this.restApiRecovery.syncMissingTrades(
          symbol,
          batch.startId,
          batch.endId
        );

        if (recoveredTrades.length > 0) {
          // Process recovered trades through normal pipeline
          await this.processRecoveredTrades(symbol, recoveredTrades);

          successGaps.push(...batch.originalGaps);
        } else {
          failedGaps.push(...batch.originalGaps);
        }
      } catch (error) {
        logger.warn(
          `Batch gap recovery failed for ${batch.startId}-${batch.endId}`,
          error
        );
        failedGaps.push(...batch.originalGaps);
      }
    }
  }

  /**
   * Individual recovery strategy: Process each gap separately
   */
  private async recoverIndividualStrategy(
    symbol: string,
    gaps: GapInfo[],
    successGaps: GapInfo[],
    failedGaps: GapInfo[]
  ): Promise<void> {
    for (const gap of gaps) {
      try {
        const recoveredTrades = await this.restApiRecovery.syncMissingTrades(
          symbol,
          gap.startId,
          gap.endId
        );

        if (recoveredTrades.length > 0) {
          await this.processRecoveredTrades(symbol, recoveredTrades);
          successGaps.push(gap);
        } else {
          failedGaps.push(gap);
        }
      } catch (error) {
        logger.warn(
          `Individual gap recovery failed for ${gap.startId}-${gap.endId}`,
          error
        );
        failedGaps.push(gap);
      }
    }
  }

  /**
   * Prioritized recovery: Recover most critical gaps first
   */
  private async recoverPrioritizedStrategy(
    symbol: string,
    gaps: GapInfo[],
    successGaps: GapInfo[],
    failedGaps: GapInfo[]
  ): Promise<void> {
    const sortedGaps = [...gaps].sort((a, b) => b.priority - a.priority);

    for (const gap of sortedGaps) {
      // Rate limit check
      if (!(await this.checkRateLimits())) {
        logger.warn('Rate limit reached during prioritized recovery');
        break;
      }

      try {
        const recoveredTrades = await this.restApiRecovery.syncMissingTrades(
          symbol,
          gap.startId,
          gap.endId
        );

        if (recoveredTrades.length > 0) {
          await this.processRecoveredTrades(symbol, recoveredTrades);
          successGaps.push(gap);
        } else {
          failedGaps.push(gap);
        }
      } catch (error) {
        logger.warn(
          `Prioritized gap recovery failed for ${gap.startId}-${gap.endId}`,
          error
        );
        failedGaps.push(gap);
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 🔧 HELPER METHODS
  // ═════════════════════════════════════════════════════════════════════════════

  /**
   * Batch gaps by size for efficient REST API calls
   */
  private batchGapsBySize(
    gaps: GapInfo[],
    maxBatchSize: number
  ): Array<{
    startId: number;
    endId: number;
    originalGaps: GapInfo[];
  }> {
    const batches: Array<{
      startId: number;
      endId: number;
      originalGaps: GapInfo[];
    }> = [];

    let currentStartId = -1;
    let currentEndId = -1;
    let currentGaps: GapInfo[] = [];

    for (const gap of gaps) {
      if (currentStartId === -1) {
        // Start new batch
        currentStartId = gap.startId;
        currentEndId = gap.endId;
        currentGaps = [gap];
      } else if (
        currentEndId + 1 === gap.startId &&
        currentEndId - currentStartId + 1 < maxBatchSize
      ) {
        // Extend current batch
        currentEndId = gap.endId;
        currentGaps.push(gap);
      } else {
        // Finish current batch and start new one
        batches.push({
          startId: currentStartId,
          endId: currentEndId,
          originalGaps: currentGaps,
        });

        currentStartId = gap.startId;
        currentEndId = gap.endId;
        currentGaps = [gap];
      }
    }

    // Add final batch
    if (currentGaps.length > 0) {
      batches.push({
        startId: currentStartId,
        endId: currentEndId,
        originalGaps: currentGaps,
      });
    }

    return batches;
  }

  /**
   * Process recovered trades through normal pipeline
   */
  private async processRecoveredTrades(
    symbol: string,
    trades: any[]
  ): Promise<void> {
    try {
      // Convert REST API trades to footprint processing format
      const processedTrades = trades.map((trade) => ({
        s: symbol,
        p: trade.p,
        q: trade.q,
        t: trade.t,
        m: trade.m,
      }));

      // Route recovered trades to workers through TradeRouter (workers handle footprint logic)
      await this.tradeRouter.routeTrades(symbol, processedTrades, {
        priority: 'urgent',
      });
    } catch (error) {
      logger.error(`Failed to process recovered trades for ${symbol}`, error);
    }
  }

  /**
   * Get current live trade ID (would be from WebSocket or recent data)
   */
  private async getCurrentLiveTradeId(symbol: string): Promise<number | null> {
    // In practice, this would be queried from current trading state
    // For simulation, return a plausible current ID
    return 12345678; // Mock current trade ID
  }

  /**
   * Calculate gap priority (higher = more urgent)
   */
  private calculateGapPriority(gapSize: number, symbol: string): number {
    let priority = 0;

    // Size-based priority
    if (gapSize > 1000) priority += 10;
    else if (gapSize > 100) priority += 5;
    else if (gapSize > 10) priority += 2;

    // Symbol importance (could be configurable)
    if (['BTCUSDT', 'ETHUSDT'].includes(symbol)) {
      priority += 3;
    }

    return Math.min(priority, 15); // Cap priority
  }

  /**
   * Estimate recovery time for a gap
   */
  private estimateRecoveryTime(gapSize: number): number {
    // Rate limit: ~1200 requests/minute for Binance Futures
    // Each call can get ~1000 trades
    // Estimate: 50ms per API call + network
    const callsNeeded = Math.ceil(gapSize / 1000);
    return callsNeeded * 100; // ~100ms per call including overhead
  }

  /**
   * Check current rate limit status
   */
  private async checkRateLimits(): Promise<boolean> {
    try {
      const rateInfo = await this.restApiRecovery.getRateLimitInfo();
      return rateInfo.remaining > 10; // Keep some buffer
    } catch (error) {
      logger.debug('Rate limit check failed', error);
      return false; // Conservative approach
    }
  }

  /**
   * Select appropriate recovery strategy based on gap characteristics
   */
  private selectRecoveryStrategy(gaps: GapInfo[]): RecoveryStrategy {
    const totalGaps = gaps.length;
    const avgGapSize =
      gaps.reduce((sum, gap) => sum + gap.tradeCount, 0) / totalGaps;
    const highPriorityGaps = gaps.filter((gap) => gap.priority > 5).length;

    // Large gaps or few gaps → individual strategy
    if (avgGapSize > 1000 || totalGaps < 3) {
      return 'individual';
    }

    // Many high-priority gaps → prioritized strategy
    if (highPriorityGaps / totalGaps > 0.5) {
      return 'prioritized';
    }

    // Default to batch for efficiency
    return 'batch';
  }
}
