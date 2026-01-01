/**
 * INFRASTRUCTURE SERVICES EXPORT
 * Utility services for tradeRouter feature
 *
 *
 * NOTE: Worker IPC functionality is now provided by the workerManagement feature
 * via WorkerCommunicationPort. Import directly from workerManagement ports.
 */

// Re-export types from workerManagement for backward compatibility
export type {
  WorkerMessage,
  WorkerResponse,
} from '../../../workerManagement/application/ports/in/WorkerCommunicationPort.js';
