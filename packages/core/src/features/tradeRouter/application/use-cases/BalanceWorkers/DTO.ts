/**
 * Data Transfer Objects: BalanceWorkers Use Case
 * Request/Response contracts for load balancing business logic
 */

export interface BalanceWorkersRequest {
  maxSymbolsPerWorker?: number;
  enforceStrictBalance?: boolean;
}

export interface BalanceWorkersResult {
  success: boolean;
  totalWorkersAffected: number;
  symbolsReassigned: number;
  balanceScoreBefore: number;
  balanceScoreAfter: number;
  message: string;
}
