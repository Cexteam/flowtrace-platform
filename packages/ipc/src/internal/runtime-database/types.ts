/**
 * Domain types for RuntimeDatabase
 *
 * Defines RuntimeDatabase-specific types (Config, Interface).
 * DTOs are imported from dto/dto.ts (single source of truth).
 */

import type {
  QueueMessageDTO,
  GapRecordDTO,
  GapRecordInputDTO,
  GapLoadOptionsDTO,
} from '../../dto/dto.js';

// =============================================================================
// RuntimeDatabase-specific types
// =============================================================================

/**
 * Configuration for RuntimeDatabase
 */
export interface RuntimeDatabaseConfig {
  /** Path to the runtime database file */
  runtimeDbPath: string;
  /** Retention hours for processed messages (default: 24) */
  retentionHours?: number;
}

/**
 * Configuration for RuntimeDatabasePoller
 */
export interface PollerConfig {
  database: RuntimeDatabaseInterface;
  pollInterval?: number;
  batchSize?: number;
  onMessage: (message: QueueMessageDTO) => Promise<void>;
}

/**
 * Configuration for RuntimeDatabasePoller without handler.
 * Use this when you want to set the handler later via setOnMessage().
 */
export interface PollerConfigWithoutHandler {
  database: RuntimeDatabaseInterface;
  pollInterval?: number;
  batchSize?: number;
}

/**
 * RuntimeDatabase interface (for dependency injection)
 */
export interface RuntimeDatabaseInterface {
  // Queue methods
  enqueue(message: QueueMessageDTO): void;
  dequeue(batchSize: number): QueueMessageDTO[];
  markProcessed(messageId: string): void;
  cleanup(retentionHours: number): number;

  // State persistence methods
  saveState(exchange: string, symbol: string, stateJson: string): void;
  saveStateBatch(
    states: Array<{ exchange: string; symbol: string; stateJson: string }>
  ): void;
  loadState(exchange: string, symbol: string): string | null;
  loadStatesBatch(
    exchange: string,
    symbols: string[]
  ): Array<{ exchange: string; symbol: string; stateJson: string }>;
  loadAllStates(): Array<{
    exchange: string;
    symbol: string;
    stateJson: string;
  }>;
  loadStatesByExchange(
    exchange: string
  ): Array<{ exchange: string; symbol: string; stateJson: string }>;

  // Gap record methods
  saveGap(gap: GapRecordInputDTO): void;
  loadGaps(options?: GapLoadOptionsDTO): GapRecordDTO[];
  markGapsSynced(gapIds: number[]): void;

  // Migration methods
  getSchemaVersion(): number;

  // Lifecycle
  close(): void;
}
