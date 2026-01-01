/**
 * StatePersistenceService - Application service for state persistence operations
 * Orchestrates state persistence operations by implementing the inbound port
 * and delegating to use cases. This service acts as the application layer
 * coordinator following hexagonal architecture.
 * Flow: Handler → Service (inbound port) → Use Case → Storage Port (outbound)
 */

import { injectable, inject } from 'inversify';
import type {
  StatePersistencePort,
  SaveStateRequest,
  SaveStateBatchRequest,
  LoadStateRequest,
  LoadStateBatchRequest,
  LoadStateResult,
  LoadStateBatchResult,
  LoadAllStatesResult,
} from '../ports/in/StatePersistencePort.js';
import type { SaveStateUseCase } from '../use-cases/SaveState/SaveStateUseCase.js';
import type { LoadStateUseCase } from '../use-cases/LoadState/LoadStateUseCase.js';
import { STATE_PERSISTENCE_TYPES } from '../../di/types.js';

/**
 * Application service that implements StatePersistencePort
 * and coordinates state persistence operations via use cases
 */
@injectable()
export class StatePersistenceService implements StatePersistencePort {
  constructor(
    @inject(STATE_PERSISTENCE_TYPES.SaveStateUseCase)
    private readonly saveStateUseCase: SaveStateUseCase,
    @inject(STATE_PERSISTENCE_TYPES.LoadStateUseCase)
    private readonly loadStateUseCase: LoadStateUseCase
  ) {}

  /**
   * Save a single CandleGroup state
   *
   * @param request - Save state request
   */
  async saveState(request: SaveStateRequest): Promise<void> {
    await this.saveStateUseCase.execute(request);
  }

  /**
   * Save multiple CandleGroup states in a single transaction
   *
   * @param request - Save state batch request
   */
  async saveStateBatch(request: SaveStateBatchRequest): Promise<void> {
    await this.saveStateUseCase.executeBatch(request);
  }

  /**
   * Load a single CandleGroup state
   *
   * @param request - Load state request
   * @returns Load state result with stateJson or null
   */
  async loadState(request: LoadStateRequest): Promise<LoadStateResult> {
    const result = await this.loadStateUseCase.execute(request);
    return { stateJson: result.stateJson };
  }

  /**
   * Load states for specific symbols
   *
   * @param request - Load state batch request
   * @returns Load state batch result with states array
   */
  async loadStateBatch(
    request: LoadStateBatchRequest
  ): Promise<LoadStateBatchResult> {
    const result = await this.loadStateUseCase.executeBatch(request);
    return { states: result.states };
  }

  /**
   * Load all persisted CandleGroup states
   *
   * @returns Load all states result with states array
   */
  async loadAllStates(): Promise<LoadAllStatesResult> {
    const result = await this.loadStateUseCase.executeAll();
    return { states: result.states };
  }
}
