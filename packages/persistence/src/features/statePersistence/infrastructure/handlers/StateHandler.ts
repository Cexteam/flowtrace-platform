/**
 * StateHandler - IPC message handler for state persistence operations
 * Handles state/save, state/save_batch, state/load, state/load_batch, state/load_all actions.
 * Delegates to StatePersistencePort (inbound port) for business logic.
 * Validates incoming data with Zod schemas.
 */

import { injectable, inject } from 'inversify';
import { z } from 'zod';
import type {
  StateMessage,
  StateResponse,
  StateSavePayload,
  StateSaveBatchPayload,
  StateLoadPayload,
  StateLoadBatchPayload,
} from '@flowtrace/ipc';
import type { StatePersistencePort } from '../../application/ports/in/StatePersistencePort.js';
import { STATE_PERSISTENCE_TYPES } from '../../di/types.js';
import { LOGGER_TYPES } from '../../../../infrastructure/logger/di/module.js';

// Zod schemas for payload validation
const StateSavePayloadSchema = z.object({
  action: z.literal('save'),
  exchange: z.string().min(1),
  symbol: z.string().min(1),
  stateJson: z.string().min(1),
});

const StateSaveBatchPayloadSchema = z.object({
  action: z.literal('save_batch'),
  states: z.array(
    z.object({
      exchange: z.string().min(1),
      symbol: z.string().min(1),
      stateJson: z.string().min(1),
    })
  ),
});

const StateLoadPayloadSchema = z.object({
  action: z.literal('load'),
  exchange: z.string().min(1),
  symbol: z.string().min(1),
});

const StateLoadBatchPayloadSchema = z.object({
  action: z.literal('load_batch'),
  exchange: z.string().min(1),
  symbols: z.array(z.string().min(1)),
});

const StateLoadAllPayloadSchema = z.object({
  action: z.literal('load_all'),
});

/**
 * Handler for state persistence IPC messages
 */
@injectable()
export class StateHandler {
  constructor(
    @inject(STATE_PERSISTENCE_TYPES.StatePersistencePort)
    private readonly statePersistence: StatePersistencePort,
    @inject(LOGGER_TYPES.Logger)
    private readonly logger: any
  ) {}

  /**
   * Check if this handler can handle the given message
   */
  canHandle(message: unknown): boolean {
    return (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      (message as { type: string }).type === 'state'
    );
  }

  /**
   * Handle a state message
   */
  async handle(message: StateMessage): Promise<StateResponse> {
    const { payload } = message;

    if (!payload || typeof payload !== 'object' || !('action' in payload)) {
      return { success: false, error: 'Invalid payload: missing action' };
    }

    const action = (payload as { action: string }).action;

    try {
      switch (action) {
        case 'save':
          return await this.handleSave(payload as StateSavePayload);
        case 'save_batch':
          return await this.handleSaveBatch(payload as StateSaveBatchPayload);
        case 'load':
          return await this.handleLoad(payload as StateLoadPayload);
        case 'load_batch':
          return await this.handleLoadBatch(payload as StateLoadBatchPayload);
        case 'load_all':
          return await this.handleLoadAll();
        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.error('State message validation failed', error, {
          action,
          errors: error.errors,
        });
        return {
          success: false,
          error: `Validation failed: ${error.errors
            .map((e) => e.message)
            .join(', ')}`,
        };
      }

      this.logger.error('State handler error', error, { action });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle state/save action
   */
  private async handleSave(payload: StateSavePayload): Promise<StateResponse> {
    const validated = StateSavePayloadSchema.parse(payload);
    await this.statePersistence.saveState({
      exchange: validated.exchange,
      symbol: validated.symbol,
      stateJson: validated.stateJson,
    });
    return { success: true };
  }

  /**
   * Handle state/save_batch action
   */
  private async handleSaveBatch(
    payload: StateSaveBatchPayload
  ): Promise<StateResponse> {
    const validated = StateSaveBatchPayloadSchema.parse(payload);
    await this.statePersistence.saveStateBatch({
      states: validated.states,
    });
    return { success: true };
  }

  /**
   * Handle state/load action
   */
  private async handleLoad(payload: StateLoadPayload): Promise<StateResponse> {
    const validated = StateLoadPayloadSchema.parse(payload);
    const result = await this.statePersistence.loadState({
      exchange: validated.exchange,
      symbol: validated.symbol,
    });
    return { success: true, data: { stateJson: result.stateJson } };
  }

  /**
   * Handle state/load_batch action
   */
  private async handleLoadBatch(
    payload: StateLoadBatchPayload
  ): Promise<StateResponse> {
    const validated = StateLoadBatchPayloadSchema.parse(payload);
    const result = await this.statePersistence.loadStateBatch({
      exchange: validated.exchange,
      symbols: validated.symbols,
    });
    return { success: true, data: { states: result.states } };
  }

  /**
   * Handle state/load_all action
   */
  private async handleLoadAll(): Promise<StateResponse> {
    StateLoadAllPayloadSchema.parse({ action: 'load_all' });
    const result = await this.statePersistence.loadAllStates();
    return { success: true, data: { states: result.states } };
  }
}
