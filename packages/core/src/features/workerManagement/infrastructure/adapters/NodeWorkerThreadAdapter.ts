/**
 * NodeWorkerThreadAdapter - Infrastructure adapter for Node.js worker threads
 *
 * Implements the WorkerThreadPort interface using Node.js worker_threads module.
 *
 */

import { injectable, inject, optional } from 'inversify';
import { Worker } from 'worker_threads';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  WorkerThreadPort,
  WorkerSpawnConfig,
  WorkerThreadInfo,
  MessageHandler,
  ErrorHandler,
  ExitHandler,
} from '../../application/ports/out/WorkerThreadPort.js';
import { createLogger } from '../../../../shared/lib/logger/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger('NodeWorkerThreadAdapter');

/**
 * DI token for custom worker script path
 * Allows platforms (server, desktop) to override the default path
 */
export const WORKER_SCRIPT_PATH_TOKEN = Symbol.for('WorkerScriptPath');

/**
 * Get the default worker script path
 *
 * Uses import.meta.url to resolve the path relative to this file's location.
 * This works correctly in both:
 * - Node.js server: __dirname is packages/core/dist/features/workerManagement/infrastructure/adapters
 * - Electron packaged app: __dirname is Resources/app/node_modules/@flowtrace/core/dist/...
 *
 * The worker.js is in packages/core/dist/worker.js (4 levels up from this file)
 *
 */
export function getDefaultWorkerScriptPath(): string {
  // __dirname is dist/features/workerManagement/infrastructure/adapters
  // worker.js is in dist/worker.js (4 levels up)
  return path.resolve(__dirname, '..', '..', '..', '..', 'worker.js');
}

/**
 * Internal worker tracking
 */
interface WorkerEntry {
  worker: Worker;
  workerId: string;
  threadId: number;
  isActive: boolean;
  messageHandlers: MessageHandler[];
  errorHandlers: ErrorHandler[];
  exitHandlers: ExitHandler[];
}

/**
 * NodeWorkerThreadAdapter - Implements WorkerThreadPort using Node.js worker_threads
 *
 * Supports custom worker script path via:
 * 1. DI injection (WORKER_SCRIPT_PATH_TOKEN)
 * 2. Environment variable (FLOWTRACE_WORKER_SCRIPT_PATH)
 * 3. Default path (worker.js in @flowtrace/core/dist)
 */
@injectable()
export class NodeWorkerThreadAdapter implements WorkerThreadPort {
  /** Map of worker ID to worker entry */
  private workers: Map<string, WorkerEntry> = new Map();

  /** Custom worker script path (injected or from env) */
  private customScriptPath: string | undefined;

  constructor(
    @inject(WORKER_SCRIPT_PATH_TOKEN)
    @optional()
    customScriptPath?: string
  ) {
    // Priority: DI injection > env variable > default
    this.customScriptPath =
      customScriptPath ||
      process.env['FLOWTRACE_WORKER_SCRIPT_PATH'] ||
      undefined;

    if (this.customScriptPath) {
      logger.info(`Using custom worker script path: ${this.customScriptPath}`);
    }
  }

  /**
   * Get the worker script path to use
   * Priority: config.scriptPath > customScriptPath > default
   */
  private getScriptPath(configScriptPath?: string): string {
    return (
      configScriptPath || this.customScriptPath || getDefaultWorkerScriptPath()
    );
  }

  /**
   * Spawn a new worker thread
   * Uses getDefaultWorkerScriptPath() if no scriptPath is provided
   */
  spawn(config: WorkerSpawnConfig): WorkerThreadInfo {
    const workerId = config.workerData?.workerId;

    if (!workerId) {
      throw new Error('WorkerSpawnConfig must include workerData.workerId');
    }

    if (this.workers.has(workerId)) {
      throw new Error(`Worker ${workerId} already exists`);
    }

    // Use getScriptPath for proper path resolution
    const scriptPath = this.getScriptPath(config.scriptPath);
    logger.info(`Spawning worker ${workerId} from ${scriptPath}`);

    // Create the worker using the new simplified worker entry point
    const worker = new Worker(scriptPath, {
      workerData: config.workerData,
      resourceLimits: config.resourceLimits,
    });

    const threadId = worker.threadId;

    // Create worker entry
    const entry: WorkerEntry = {
      worker,
      workerId,
      threadId,
      isActive: true,
      messageHandlers: [],
      errorHandlers: [],
      exitHandlers: [],
    };

    // Set up internal event handlers
    worker.on('message', (message) => {
      for (const handler of entry.messageHandlers) {
        try {
          handler(message);
        } catch (error) {
          logger.error(
            `Error in message handler for worker ${workerId}: ${
              (error as Error).message
            }`
          );
        }
      }
    });

    worker.on('error', (error) => {
      logger.error(`Worker ${workerId} error: ${error.message}`);
      for (const handler of entry.errorHandlers) {
        try {
          handler(error);
        } catch (err) {
          logger.error(
            `Error in error handler for worker ${workerId}: ${
              (err as Error).message
            }`
          );
        }
      }
    });

    worker.on('exit', (exitCode) => {
      logger.info(`Worker ${workerId} exited with code ${exitCode}`);
      entry.isActive = false;

      for (const handler of entry.exitHandlers) {
        try {
          handler(exitCode);
        } catch (error) {
          logger.error(
            `Error in exit handler for worker ${workerId}: ${
              (error as Error).message
            }`
          );
        }
      }
    });

    // Store the worker
    this.workers.set(workerId, entry);

    logger.info(`Worker ${workerId} spawned (threadId: ${threadId})`);

    return {
      workerId,
      worker,
      threadId,
      isActive: true,
    };
  }

  /**
   * Terminate a worker thread
   */
  async terminate(workerId: string): Promise<void> {
    const entry = this.workers.get(workerId);

    if (!entry) {
      logger.warn(`Worker ${workerId} not found for termination`);
      return;
    }

    logger.info(`Terminating worker ${workerId}...`);

    try {
      await entry.worker.terminate();
      entry.isActive = false;
      this.workers.delete(workerId);
      logger.info(`Worker ${workerId} terminated`);
    } catch (error) {
      logger.error(
        `Error terminating worker ${workerId}: ${(error as Error).message}`
      );
      throw error;
    }
  }

  /**
   * Post a message to a worker thread
   */
  postMessage(workerId: string, message: unknown): void {
    const entry = this.workers.get(workerId);

    if (!entry) {
      throw new Error(`Worker ${workerId} not found`);
    }

    if (!entry.isActive) {
      throw new Error(`Worker ${workerId} is not active`);
    }

    entry.worker.postMessage(message);
  }

  /**
   * Register a message handler for a worker
   */
  onMessage(workerId: string, handler: MessageHandler): void {
    const entry = this.workers.get(workerId);

    if (!entry) {
      throw new Error(`Worker ${workerId} not found`);
    }

    entry.messageHandlers.push(handler);
  }

  /**
   * Register an error handler for a worker
   */
  onError(workerId: string, handler: ErrorHandler): void {
    const entry = this.workers.get(workerId);

    if (!entry) {
      throw new Error(`Worker ${workerId} not found`);
    }

    entry.errorHandlers.push(handler);
  }

  /**
   * Register an exit handler for a worker
   */
  onExit(workerId: string, handler: ExitHandler): void {
    const entry = this.workers.get(workerId);

    if (!entry) {
      throw new Error(`Worker ${workerId} not found`);
    }

    entry.exitHandlers.push(handler);
  }

  /**
   * Get information about a worker
   */
  getWorkerInfo(workerId: string): WorkerThreadInfo | undefined {
    const entry = this.workers.get(workerId);

    if (!entry) {
      return undefined;
    }

    return {
      workerId: entry.workerId,
      worker: entry.worker,
      threadId: entry.threadId,
      isActive: entry.isActive,
    };
  }

  /**
   * Check if a worker exists
   */
  hasWorker(workerId: string): boolean {
    return this.workers.has(workerId);
  }

  /**
   * Get all worker IDs
   */
  getAllWorkerIds(): string[] {
    return Array.from(this.workers.keys());
  }
}
