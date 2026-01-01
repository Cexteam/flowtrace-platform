/**
 * Data Transfer Objects for GetExchange Use Case
 *
 * Clean Architecture: Define data structures for use case inputs/outputs
 */

import type { Exchange } from '../../../domain/entities/Exchange.js';

/**
 * Request to get exchange
 */
export interface GetExchangeRequest {
  exchangeId: string;
}

/**
 * Response containing exchange
 */
export interface GetExchangeResponse {
  exchange: Exchange | null;
  found: boolean;
}
