/**
 * SpawnWorker Use Case DTOs
 *
 * Data transfer objects for the SpawnWorker use case.
 */

/**
 * Request to spawn a new worker
 */
export interface SpawnWorkerRequest {
  /** Unique identifier for the worker */
  workerId: string;
  /** Path to the worker script (optional - uses DEFAULT_WORKER_SCRIPT_PATH if not provided) */
  scriptPath?: string;
  /** Initial symbols to assign to the worker */
  initialSymbols?: string[];
  /**
   * IPC socket path for persistence service communication
   */
  socketPath?: string;
  /** Resource limits for the worker */
  resourceLimits?: {
    maxOldGenerationSizeMb?: number;
    maxYoungGenerationSizeMb?: number;
    codeRangeSizeMb?: number;
    stackSizeMb?: number;
  };
}

/**
 * Result of spawning a worker
 */
export interface SpawnWorkerResult {
  /** Whether the spawn was successful */
  success: boolean;
  /** The worker ID */
  workerId: string;
  /** Thread ID assigned by Node.js */
  threadId?: number;
  /** Error message if spawn failed */
  error?: string;
  /** Time taken to spawn in milliseconds */
  spawnTimeMs: number;
}
