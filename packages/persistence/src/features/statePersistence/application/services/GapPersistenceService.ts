/**
 * GapPersistenceService - Application service for gap persistence operations
 * Orchestrates gap persistence operations by implementing the inbound port
 * and delegating to use cases. This service acts as the application layer
 * coordinator following hexagonal architecture.
 * Flow: Handler → Service (inbound port) → Use Case → Storage Port (outbound)
 */

import { injectable, inject } from 'inversify';
import type {
  GapPersistencePort,
  SaveGapRequest,
  LoadGapsRequest,
  LoadGapsResult,
  MarkGapsSyncedRequest,
} from '../ports/in/GapPersistencePort.js';
import type { SaveGapUseCase } from '../use-cases/SaveGap/SaveGapUseCase.js';
import type { LoadGapsUseCase } from '../use-cases/LoadGaps/LoadGapsUseCase.js';
import type { GapStoragePort } from '../ports/out/GapStoragePort.js';
import { STATE_PERSISTENCE_TYPES } from '../../di/types.js';

/**
 * Application service that implements GapPersistencePort
 * and coordinates gap persistence operations via use cases
 */
@injectable()
export class GapPersistenceService implements GapPersistencePort {
  constructor(
    @inject(STATE_PERSISTENCE_TYPES.SaveGapUseCase)
    private readonly saveGapUseCase: SaveGapUseCase,
    @inject(STATE_PERSISTENCE_TYPES.LoadGapsUseCase)
    private readonly loadGapsUseCase: LoadGapsUseCase,
    @inject(STATE_PERSISTENCE_TYPES.GapStoragePort)
    private readonly gapStorage: GapStoragePort
  ) {}

  /**
   * Save a gap record
   *
   * @param request - Save gap request
   */
  async saveGap(request: SaveGapRequest): Promise<void> {
    await this.saveGapUseCase.execute(request);
  }

  /**
   * Load gap records with optional filtering
   *
   * @param request - Load gaps request with optional filters
   * @returns Load gaps result with gaps array
   */
  async loadGaps(request: LoadGapsRequest): Promise<LoadGapsResult> {
    const result = await this.loadGapsUseCase.execute(request);
    return { gaps: result.gaps };
  }

  /**
   * Mark gap records as synced
   *
   * Note: This operation doesn't have a dedicated use case as it's a simple
   * update operation without complex business logic. It delegates directly
   * to the storage port.
   *
   * @param request - Mark gaps synced request
   */
  async markGapsSynced(request: MarkGapsSyncedRequest): Promise<void> {
    await this.gapStorage.markSynced(request.gapIds);
  }
}
