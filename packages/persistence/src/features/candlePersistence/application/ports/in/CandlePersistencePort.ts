/**
 * CandlePersistencePort
 * Inbound port for candle persistence operations.
 * Defines the interface for persisting completed candles.
 */

import type { FootprintCandle } from '@flowtrace/core';

export interface PersistCandleRequest {
  candle: FootprintCandle;
  source: 'unix-socket' | 'sqlite-queue';
  messageId: string;
}

export interface PersistCandleResult {
  success: boolean;
  candleId: string;
  persistedAt: number;
}

export interface CandlePersistencePort {
  /**
   * Persist a completed candle
   *
   * @param request - Persist candle request with source information
   * @returns Result with candle ID and timestamp
   */
  persistCandle(request: PersistCandleRequest): Promise<PersistCandleResult>;
}
