// Application Layer - Data Transfer Objects for DeactivateSymbolUseCase
// Clean Architecture: Define data structures for use case inputs/outputs

export interface DeactivateSymbolRequest {
  symbolId: string; // Format: "exchange:symbol" or generated ID
}

export interface DeactivateSymbolResponse {
  success: boolean;
  symbolId: string;
  symbol?: string; // Symbol name (e.g., "BTCUSDT")
  exchange?: string; // Exchange name (e.g., "binance")
  message: string;
  error?: string;
  timestamp: Date;
}
