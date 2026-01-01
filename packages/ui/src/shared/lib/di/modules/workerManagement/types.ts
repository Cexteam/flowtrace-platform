/**
 * Worker Management UI DI Types
 *
 * Defines dependency injection symbols for the workerManagement UI feature.
 * Following Hexagonal Architecture pattern with ports and adapters.
 *
 */

// Re-export domain types for convenience
export type {
  Worker,
  WorkerState,
  WorkerHealthMetrics,
  WorkerSpawnConfig,
  WorkerSpawnResult,
} from '../../../../../features/workerManagement/domain';

// Re-export port types
export type {
  WorkerApiPort,
  GetWorkersRequest,
  GetWorkersResponse,
} from '../../../../../features/workerManagement/application/ports/out/WorkerApiPort';

export const WORKER_UI_TYPES = {
  // Port Out - API adapters
  WorkerApiPort: Symbol.for('WorkerUI.WorkerApiPort'),

  // Port In - Operations
  WorkerOperationsPort: Symbol.for('WorkerUI.WorkerOperationsPort'),

  // Adapters
  HttpWorkerAdapter: Symbol.for('WorkerUI.HttpWorkerAdapter'),
  IpcWorkerAdapter: Symbol.for('WorkerUI.IpcWorkerAdapter'),
} as const;

export type WorkerUITypes = typeof WORKER_UI_TYPES;
