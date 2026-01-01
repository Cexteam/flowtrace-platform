// Application Layer - Data Transfer Objects for RemoveSymbolsFromIngestionUseCase
// Clean Architecture: Define data structures for use case inputs/outputs

export interface RemoveSymbolsFromIngestionRequest {
  symbols: string[];
}

export interface RemoveSymbolsFromIngestionResponse {
  success: boolean;
  results: Array<{
    symbol: string;
    removed: boolean;
    error?: string;
  }>;
  removedSymbols: string[];
  notConnectedSymbols: string[];
  totalRequested: number;
  timestamp: Date;
  errors?: string[];
}
