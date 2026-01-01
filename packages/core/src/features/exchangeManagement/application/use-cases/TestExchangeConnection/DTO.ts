/**
 * Data Transfer Objects for TestExchangeConnection Use Case
 *
 * Clean Architecture: Define data structures for use case inputs/outputs
 */

/**
 * Request to test exchange connection
 */
export interface TestExchangeConnectionRequest {
  exchangeId: string;
  useStoredCredentials?: boolean;
  apiKey?: string;
  apiSecret?: string;
}

/**
 * Response for connection test
 */
export interface TestExchangeConnectionResponse {
  exchangeId: string;
  success: boolean;
  latencyMs?: number;
  error?: string;
  testedAt: Date;
}
