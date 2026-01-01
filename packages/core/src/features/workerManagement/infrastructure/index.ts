/**
 * WorkerManagement Infrastructure Layer Index
 *
 * Export adapters and DI module.
 */

// Adapters
export {
  NodeWorkerThreadAdapter,
  WORKER_SCRIPT_PATH_TOKEN,
  getDefaultWorkerScriptPath,
  DEFAULT_WORKER_SCRIPT_PATH,
} from './adapters/NodeWorkerThreadAdapter.js';
