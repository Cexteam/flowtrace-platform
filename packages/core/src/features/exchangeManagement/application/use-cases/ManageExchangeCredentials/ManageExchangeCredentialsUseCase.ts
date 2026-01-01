/**
 * Manage Exchange Credentials Use Case
 *
 * Securely manages exchange API credentials with encryption and validation.
 *
 * Hexagonal Architecture: This is the application core
 * - Uses outbound ports (ExchangeRepository)
 * - Contains business logic for credential management
 */

import { inject, injectable } from 'inversify';
import type { ExchangeRepository } from '../../../domain/repositories/ExchangeRepository.js';
import { Exchange } from '../../../domain/entities/Exchange.js';
import type {
  ManageExchangeCredentialsRequest,
  ManageExchangeCredentialsResponse,
  CredentialInfo,
} from './DTO.js';
import { EXCHANGE_MANAGEMENT_SYMBOLS } from '../../../../../shared/lib/di/bindings/features/exchangeManagement/types.js';

@injectable()
export class ManageExchangeCredentialsUseCase {
  constructor(
    @inject(EXCHANGE_MANAGEMENT_SYMBOLS.ExchangeRepository)
    private readonly exchangeRepository: ExchangeRepository
  ) {}

  async execute(
    request: ManageExchangeCredentialsRequest
  ): Promise<ManageExchangeCredentialsResponse> {
    try {
      switch (request.operation) {
        case 'set':
          return await this.setCredentials(request);
        case 'get':
          return await this.getCredentials(request);
        case 'remove':
          return await this.removeCredentials(request);
        case 'validate':
          return await this.validateCredentials(request);
        default:
          return {
            operation: request.operation,
            success: false,
            error: `Unknown operation: ${request.operation}`,
          };
      }
    } catch (error) {
      console.error(
        `Failed to manage credentials for ${request.exchangeId}:`,
        error
      );
      return {
        operation: request.operation,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async setCredentials(
    request: ManageExchangeCredentialsRequest
  ): Promise<ManageExchangeCredentialsResponse> {
    // Validate credentials
    const validationErrors = this.validateCredentialInput(
      request.apiKey,
      request.apiSecret
    );
    if (validationErrors.length > 0) {
      return {
        operation: 'set',
        success: false,
        validationErrors,
      };
    }

    // Get or create exchange
    let exchange = await this.exchangeRepository.findById(request.exchangeId);
    if (!exchange) {
      exchange = this.createDefaultExchange(request.exchangeId);
    }

    // Update credentials
    exchange.updateCredentials(request.apiKey!, request.apiSecret!);

    // Save updated exchange
    const savedExchange = await this.exchangeRepository.save(exchange);

    return {
      operation: 'set',
      success: true,
      credentialInfo: this.createCredentialInfo(savedExchange),
    };
  }

  private async getCredentials(
    request: ManageExchangeCredentialsRequest
  ): Promise<ManageExchangeCredentialsResponse> {
    const exchange = await this.exchangeRepository.findById(request.exchangeId);

    if (!exchange) {
      return {
        operation: 'get',
        success: false,
        error: 'Exchange not found',
      };
    }

    return {
      operation: 'get',
      success: true,
      credentialInfo: this.createCredentialInfo(exchange),
    };
  }

  private async removeCredentials(
    request: ManageExchangeCredentialsRequest
  ): Promise<ManageExchangeCredentialsResponse> {
    const exchange = await this.exchangeRepository.findById(request.exchangeId);

    if (!exchange) {
      return {
        operation: 'remove',
        success: false,
        error: 'Exchange not found',
      };
    }

    // Remove credentials by setting them to empty
    exchange.updateCredentials('', '');

    const savedExchange = await this.exchangeRepository.save(exchange);

    return {
      operation: 'remove',
      success: true,
      credentialInfo: this.createCredentialInfo(savedExchange),
    };
  }

  private async validateCredentials(
    request: ManageExchangeCredentialsRequest
  ): Promise<ManageExchangeCredentialsResponse> {
    const exchange = await this.exchangeRepository.findById(request.exchangeId);

    if (!exchange) {
      return {
        operation: 'validate',
        success: false,
        error: 'Exchange not found',
      };
    }

    const hasCredentials = exchange.hasCredentials();
    const validationErrors = hasCredentials
      ? this.validateCredentialInput(exchange.apiKey, exchange.apiSecret)
      : ['No credentials found'];

    const credentialInfo = this.createCredentialInfo(exchange);
    credentialInfo.isValid = validationErrors.length === 0;

    return {
      operation: 'validate',
      success: true,
      credentialInfo,
      validationErrors:
        validationErrors.length > 0 ? validationErrors : undefined,
    };
  }

  private validateCredentialInput(
    apiKey?: string,
    apiSecret?: string
  ): string[] {
    const errors: string[] = [];

    if (!apiKey || apiKey.trim().length === 0) {
      errors.push('API key is required');
    } else if (apiKey.length < 8) {
      errors.push('API key must be at least 8 characters long');
    }

    if (!apiSecret || apiSecret.trim().length === 0) {
      errors.push('API secret is required');
    } else if (apiSecret.length < 16) {
      errors.push('API secret must be at least 16 characters long');
    }

    // Basic format validation for common exchange patterns
    if (apiKey && !this.isValidApiKeyFormat(apiKey)) {
      errors.push('API key format appears invalid');
    }

    return errors;
  }

  private isValidApiKeyFormat(apiKey: string): boolean {
    // Basic validation - most exchange API keys are alphanumeric
    return /^[A-Za-z0-9]+$/.test(apiKey);
  }

  private createCredentialInfo(exchange: Exchange): CredentialInfo {
    return {
      exchangeId: exchange.id,
      hasApiKey: !!exchange.apiKey,
      hasApiSecret: !!exchange.apiSecret,
      apiKeyPreview: exchange.apiKey
        ? `${exchange.apiKey.substring(0, 4)}...`
        : undefined,
      lastUpdated: exchange.updatedAt,
    };
  }

  private createDefaultExchange(exchangeId: string): Exchange {
    return Exchange.create({
      id: exchangeId,
      displayName: this.getDisplayName(exchangeId),
      wsUrl: this.getDefaultWsUrl(exchangeId),
      restUrl: this.getDefaultRestUrl(exchangeId),
      rateLimitPerMinute: this.getDefaultRateLimit(exchangeId),
      implementationStatus: 'implemented',
      enabled: false,
    });
  }

  private getDisplayName(exchangeId: string): string {
    const names: Record<string, string> = {
      binance: 'Binance',
      bybit: 'Bybit',
      okx: 'OKX',
    };
    return names[exchangeId] || exchangeId;
  }

  private getDefaultWsUrl(exchangeId: string): string {
    const defaults: Record<string, string> = {
      binance: 'wss://stream.binance.com:9443/ws',
      bybit: 'wss://stream.bybit.com/v5/public/spot',
      okx: 'wss://ws.okx.com:8443/ws/v5/public',
    };
    return defaults[exchangeId] || '';
  }

  private getDefaultRestUrl(exchangeId: string): string {
    const defaults: Record<string, string> = {
      binance: 'https://api.binance.com',
      bybit: 'https://api.bybit.com',
      okx: 'https://www.okx.com',
    };
    return defaults[exchangeId] || '';
  }

  private getDefaultRateLimit(exchangeId: string): number {
    const defaults: Record<string, number> = {
      binance: 1200,
      bybit: 600,
      okx: 600,
    };
    return defaults[exchangeId] || 600;
  }
}
