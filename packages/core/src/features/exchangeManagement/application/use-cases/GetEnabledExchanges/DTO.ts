/**
 * Data Transfer Objects for GetEnabledExchanges Use Case
 *
 * Clean Architecture: Define data structures for use case inputs/outputs
 */

import type { Exchange } from '../../../domain/entities/Exchange.js';

/**
 * Request to get enabled exchanges
 */
export interface GetEnabledExchangesRequest {
  // No parameters needed - gets all enabled exchanges
}

/**
 * Response containing enabled exchanges
 */
export interface GetEnabledExchangesResponse {
  exchanges: Exchange[];
  count: number;
  hasFallbacks: boolean;
}
