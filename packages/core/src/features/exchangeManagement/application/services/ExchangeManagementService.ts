/**
 * Exchange Management Service
 *
 * Orchestrates exchange management operations using use cases
 */

import { injectable, inject } from 'inversify';
import { EXCHANGE_MANAGEMENT_TYPES } from '../../../../shared/lib/di/bindings/features/exchangeManagement/types.js';
import type { ExchangeManagementPort } from '../ports/in/ExchangeManagementPort.js';

// Import use cases
import type { GetAllExchangesUseCase } from '../use-cases/GetAllExchanges/GetAllExchangesUseCase.js';
import type { GetExchangeUseCase } from '../use-cases/GetExchange/GetExchangeUseCase.js';
import type { UpdateExchangeUseCase } from '../use-cases/UpdateExchange/UpdateExchangeUseCase.js';
import type { TestExchangeConnectionUseCase } from '../use-cases/TestExchangeConnection/TestExchangeConnectionUseCase.js';

@injectable()
export class ExchangeManagementService implements ExchangeManagementPort {
  constructor(
    @inject(EXCHANGE_MANAGEMENT_TYPES.GetAllExchangesUseCase)
    private readonly getAllExchangesUseCase: GetAllExchangesUseCase,

    @inject(EXCHANGE_MANAGEMENT_TYPES.GetExchangeUseCase)
    private readonly getExchangeUseCase: GetExchangeUseCase,

    @inject(EXCHANGE_MANAGEMENT_TYPES.UpdateExchangeUseCase)
    private readonly updateExchangeUseCase: UpdateExchangeUseCase,

    @inject(EXCHANGE_MANAGEMENT_TYPES.TestExchangeConnectionUseCase)
    private readonly testExchangeConnectionUseCase: TestExchangeConnectionUseCase
  ) {}

  // Implement ExchangeManagementPort interface using use cases
  async getExchanges(filter?: any): Promise<any[]> {
    // Use GetAllExchangesUseCase to support filtering
    const response = await this.getAllExchangesUseCase.execute({ filter });
    return response.exchanges;
  }

  async getExchangeById(exchangeId: string): Promise<any> {
    const response = await this.getExchangeUseCase.execute({
      exchangeId,
    });
    return response.exchange;
  }

  async getExchangeHealth(exchangeId: string): Promise<any> {
    const response = await this.testExchangeConnectionUseCase.execute({
      exchangeId,
    });
    return {
      exchangeId,
      healthy: response.success,
      lastCheck: new Date(),
      details: response,
    };
  }

  async enableExchange(exchangeId: string): Promise<any> {
    const response = await this.updateExchangeUseCase.execute({
      exchangeId,
      enabled: true,
    });
    return response.exchange;
  }

  async disableExchange(exchangeId: string): Promise<any> {
    const response = await this.updateExchangeUseCase.execute({
      exchangeId,
      enabled: false,
    });
    return response.exchange;
  }
}
