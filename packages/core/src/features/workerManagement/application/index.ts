/**
 * WorkerManagement Application Layer Index
 *
 * Export ports, services, and use cases.
 */

// Ports - In
export {
  WorkerPoolPort,
  WorkerPoolStatus,
  WorkerPoolConfig,
} from './ports/in/WorkerPoolPort.js';

export {
  WorkerCommunicationPort,
  WorkerMessage,
  WorkerResponse,
  WorkerMessageType,
  SendMessageOptions,
} from './ports/in/WorkerCommunicationPort.js';

export {
  WorkerHealthMonitorPort,
  WorkerHealthStatus,
  SystemHealthOverview,
} from './ports/in/WorkerHealthMonitorPort.js';

// Ports - Out
export {
  WorkerThreadPort,
  WorkerSpawnConfig,
  WorkerThreadInfo,
  MessageHandler,
  ErrorHandler,
  ExitHandler,
} from './ports/out/WorkerThreadPort.js';

// Services
export { WorkerPoolService } from './services/WorkerPoolService.js';
export { WorkerIPCService } from './services/WorkerIPCService.js';
export { WorkerHealthMonitorService } from './services/WorkerHealthMonitorService.js';

// Use Cases
export {
  SpawnWorkerUseCase,
  SpawnWorkerRequest,
  SpawnWorkerResult,
} from './use-cases/SpawnWorker/index.js';

export {
  CheckWorkerHealthUseCase,
  CheckWorkerHealthRequest,
  CheckWorkerHealthResult,
  CheckAllWorkersHealthRequest,
  CheckAllWorkersHealthResult,
} from './use-cases/CheckWorkerHealth/index.js';

export {
  GetSystemHealthUseCase,
  GetSystemHealthResult,
  GetAllWorkersHealthStatusResult,
  GetUnhealthyWorkersResult,
} from './use-cases/GetSystemHealth/index.js';
