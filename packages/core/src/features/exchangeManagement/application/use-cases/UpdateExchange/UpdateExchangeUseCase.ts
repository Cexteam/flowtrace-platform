/**
 * Update Exchange Use Case
 *
 * Updates exchange with validation.
 */

import { inject, injectable } from 'inversify';
import type { ExchangeRepository } from '../../../domain/repositories/ExchangeRepository.js';
import type { Exchange } from '../../../domain/entities/Exchange.js';
import type { UpdateExchangeRequest, UpdateExchangeResponse } from './DTO.js';
import { EXCHANGE_MANAGEMENT_SYMBOLS } from '../../../../../shared/lib/di/bindings/features/exchangeManagement/types.js';

@injectable()
export class UpdateExchangeUseCase {
  constructor(
    @inject(EXCHANGE_MANAGEMENT_SYMBOLS.ExchangeRepository)
    private readonly exchangeRepository: ExchangeRepository
  ) {}

  async execute(
    request: UpdateExchangeRequest
  ): Promise<UpdateExchangeResponse> {
    try {
      // Get existing exchange
      const existingExchange = await this.exchangeRepository.findById(
        request.exchangeId
      );

      if (!existingExchange) {
        return {
          exchange: null as any,
          success: false,
          error: 'Exchange not found',
        };
      }

      // Update exchange properties
      const updatedExchange = {
        ...existingExchange,
        enabled: request.enabled ?? existingExchange.enabled,
        wsUrl: request.wsUrl ?? existingExchange.wsUrl,
        restUrl: request.restUrl ?? existingExchange.restUrl,
        rateLimitPerMinute:
          request.rateLimitPerMinute ?? existingExchange.rateLimitPerMinute,
        updatedAt: new Date(),
      } as any;

      // Save the updated exchange
      const savedExchange = await this.exchangeRepository.save(updatedExchange);

      return {
        exchange: savedExchange,
        success: true,
      };
    } catch (error) {
      console.error(
        `Failed to update exchange config for ${request.exchangeId}:`,
        error
      );

      return {
        exchange: null as any,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
