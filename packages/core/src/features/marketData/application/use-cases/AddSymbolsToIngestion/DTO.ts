// Application Layer - Data Transfer Objects for AddSymbolsToIngestionUseCase
// Clean Architecture: Define data structures for use case inputs/outputs

export interface AddSymbolsToIngestionRequest {
  symbols: string[];
  skipExisting?: boolean; // Skip if already connected
  initializeFootprint?: boolean; // Default true
}

export interface AddSymbolsToIngestionResponse {
  success: boolean;
  results: Array<{
    symbol: string;
    added: boolean;
    error?: string;
  }>;
  addedSymbols: string[];
  skippedSymbols: string[];
  totalRequested: number;
  timestamp: Date;
  errors?: string[];
}
