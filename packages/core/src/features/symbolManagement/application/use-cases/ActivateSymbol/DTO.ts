// Application Layer - Data Transfer Objects for ActivateSymbolUseCase
// Clean Architecture: Define data structures for use case inputs/outputs

export interface ActivateSymbolRequest {
  symbolId: string; // Format: "exchange:symbol" or generated ID
}

export interface ActivateSymbolResponse {
  success: boolean;
  symbolId: string;
  symbol?: string; // Symbol name (e.g., "BTCUSDT")
  exchange?: string; // Exchange name (e.g., "binance")
  message: string;
  error?: string;
  timestamp: Date;
}
