/**
 * WorkerManagement Application Layer Index
 *
 * Export ports, services, and use cases.
 */

// ============================================================================
// Ports - In (New unified ports)
// ============================================================================

export {
  WorkerManagementPort,
  WorkerPoolConfig,
  WorkerMessage,
  WorkerResponse,
  WorkerMessageType,
  SendMessageOptions,
  RouteTradesResult,
  InitializeSymbolRoutingResult,
} from './ports/in/WorkerManagementPort.js';

export {
  WorkerStatusPort,
  WorkerPoolStatus,
  WorkerHealthStatus,
  SystemHealthOverview,
} from './ports/in/WorkerStatusPort.js';

// ============================================================================
// Ports - Out
// ============================================================================

export {
  WorkerThreadPort,
  WorkerSpawnConfig,
  WorkerThreadInfo,
  MessageHandler,
  ErrorHandler,
  ExitHandler,
} from './ports/out/WorkerThreadPort.js';

// ============================================================================
// Services (New unified services)
// ============================================================================

export { WorkerManagementService } from './services/WorkerManagementService.js';
export { WorkerStatusService } from './services/WorkerStatusService.js';

// ============================================================================
// Use Cases (existing)
// ============================================================================

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

// ============================================================================
// Use Cases (moved from tradeRouter)
// ============================================================================

export {
  RouteTradesUseCase,
  RouteTradesRequest,
  RouteTradesResult as RouteTradesUseCaseResult,
  RouteTradesSuccess,
  RouteTradesError,
} from './use-cases/RouteTrades/index.js';

export {
  AssignSymbolToWorkerUseCase,
  AssignSymbolToWorkerRequest,
  AssignSymbolToWorkerResult,
} from './use-cases/AssignSymbolToWorker/index.js';

export {
  RemoveSymbolFromWorkerUseCase,
  RemoveSymbolFromWorkerRequest,
  RemoveSymbolFromWorkerResult,
} from './use-cases/RemoveSymbolFromWorker/index.js';
