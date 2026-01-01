/**
 * Get Exchange Use Case
 *
 * Retrieves exchange by exchange ID.
 *
 * Hexagonal Architecture: This is the application core
 * - Uses outbound ports (ExchangeRepository)
 * - Contains business logic for retrieving exchange
 */

import { inject, injectable } from 'inversify';
import type { ExchangeRepository } from '../../../domain/repositories/ExchangeRepository.js';
import type { GetExchangeRequest, GetExchangeResponse } from './DTO.js';
import { EXCHANGE_MANAGEMENT_SYMBOLS } from '../../../../../shared/lib/di/bindings/features/exchangeManagement/types.js';

@injectable()
export class GetExchangeUseCase {
  constructor(
    @inject(EXCHANGE_MANAGEMENT_SYMBOLS.ExchangeRepository)
    private readonly exchangeRepository: ExchangeRepository
  ) {}

  async execute(request: GetExchangeRequest): Promise<GetExchangeResponse> {
    try {
      const exchange = await this.exchangeRepository.findById(
        request.exchangeId
      );

      return {
        exchange,
        found: exchange !== null,
      };
    } catch (error) {
      // Log error but don't throw - return not found instead
      console.error(
        `Failed to get exchange config for ${request.exchangeId}:`,
        error
      );

      return {
        exchange: null,
        found: false,
      };
    }
  }
}
