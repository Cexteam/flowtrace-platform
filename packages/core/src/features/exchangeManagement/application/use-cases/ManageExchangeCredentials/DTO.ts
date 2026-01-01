/**
 * Data Transfer Objects for ManageExchangeCredentials Use Case
 *
 * Clean Architecture: Define data structures for use case inputs/outputs
 */

/**
 * Credential operation types
 */
export type CredentialOperation = 'set' | 'get' | 'remove' | 'validate';

/**
 * Request to manage exchange credentials
 */
export interface ManageExchangeCredentialsRequest {
  exchangeId: string;
  operation: CredentialOperation;
  apiKey?: string;
  apiSecret?: string;
}

/**
 * Credential information (safe for external consumption)
 */
export interface CredentialInfo {
  exchangeId: string;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  apiKeyPreview?: string; // First 4 characters + "..."
  lastUpdated: Date;
  isValid?: boolean;
}

/**
 * Response for credential management operations
 */
export interface ManageExchangeCredentialsResponse {
  operation: CredentialOperation;
  success: boolean;
  credentialInfo?: CredentialInfo;
  validationErrors?: string[];
  error?: string;
}
