/**
 * Data Transfer Objects for PersistCandle use case
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
