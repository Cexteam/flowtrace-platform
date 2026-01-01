/**
 * Get All Exchanges Use Case DTOs
 */

import type { Exchange } from '../../../domain/entities/Exchange.js';
import type { ExchangeFilter } from '../../../domain/repositories/ExchangeRepository.js';

/**
 * Request DTO for getting all exchanges
 */
export interface GetAllExchangesRequest {
  filter?: ExchangeFilter;
}

/**
 * Response DTO for getting all exchanges
 */
export interface GetAllExchangesResponse {
  exchanges: Exchange[];
  count: number;
}
