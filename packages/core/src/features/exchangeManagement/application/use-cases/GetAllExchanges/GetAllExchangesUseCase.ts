/**
 * Get All Exchanges Use Case
 *
 * Retrieves all exchanges with optional filtering.
 *
 * Hexagonal Architecture: This is the application core
 * - Uses outbound ports (ExchangeRepository)
 * - Contains business logic for retrieving all exchanges
 */

import { inject, injectable } from 'inversify';
import type { ExchangeRepository } from '../../../domain/repositories/ExchangeRepository.js';
import type { GetAllExchangesRequest, GetAllExchangesResponse } from './DTO.js';
import { EXCHANGE_MANAGEMENT_SYMBOLS } from '../../../../../shared/lib/di/bindings/features/exchangeManagement/types.js';

@injectable()
export class GetAllExchangesUseCase {
  constructor(
    @inject(EXCHANGE_MANAGEMENT_SYMBOLS.ExchangeRepository)
    private readonly exchangeRepository: ExchangeRepository
  ) {}

  async execute(
    request: GetAllExchangesRequest
  ): Promise<GetAllExchangesResponse> {
    try {
      const exchanges = await this.exchangeRepository.findAll(request.filter);

      return {
        exchanges,
        count: exchanges.length,
      };
    } catch (error) {
      console.error('Failed to get all exchanges:', error);

      return {
        exchanges: [],
        count: 0,
      };
    }
  }
}
