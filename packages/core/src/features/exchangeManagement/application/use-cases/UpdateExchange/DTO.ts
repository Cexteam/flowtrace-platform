/**
 * Data Transfer Objects for UpdateExchange Use Case
 *
 * Clean Architecture: Define data structures for use case inputs/outputs
 */

import type { Exchange } from '../../../domain/entities/Exchange.js';

/**
 * Request to update exchange
 */
export interface UpdateExchangeRequest {
  exchangeId: string;
  enabled?: boolean;
  wsUrl?: string;
  restUrl?: string;
  rateLimitPerMinute?: number;
}

/**
 * Response for exchange update
 */
export interface UpdateExchangeResponse {
  exchange: Exchange;
  success: boolean;
  error?: string;
}
