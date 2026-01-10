/**
 * ProcessTrade DTOs
 *
 * Request and Response types for ProcessTradeUseCase
 */

import { TradeData } from '../../../domain/value-objects/TradeData.js';
import { SymbolConfig } from '../../../domain/types/index.js';
import { CandleGroup } from '../../../domain/entities/CandleGroup.js';
import { FootprintCandle } from '../../../domain/entities/FootprintCandle.js';

/**
 * Request to process a trade
 */
export interface ProcessTradeRequest {
  /** Trade data to process */
  trade: TradeData;
  /** Symbol configuration */
  config: SymbolConfig;
}

/**
 * Gap detection result
 * Contains information about a detected gap in trade sequence
 *
 */
export interface GapDetectionResult {
  /** Whether a gap was detected */
  detected: boolean;
  /** Symbol where gap was detected */
  symbol: string;
  /** First missing trade ID */
  fromTradeId: number;
  /** Last missing trade ID */
  toTradeId: number;
  /** Number of missing trades */
  gapSize: number;
  /** Timestamp when gap was detected */
  detectedAt: number;
}

/**
 * Result of processing a trade
 */
export interface ProcessTradeResult {
  /** Whether the trade was processed successfully */
  success: boolean;
  /** Updated candle group */
  candleGroup: CandleGroup;
  /** Candles that completed during this trade */
  completedCandles: FootprintCandle[];
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Gap detection result (if a gap was detected) */
  gapDetected?: GapDetectionResult;
  /** Whether the trade was skipped (duplicate or out-of-order) */
  skipped?: boolean;
  /** Reason for skipping the trade */
  skipReason?: 'duplicate' | 'out_of_order';
}
