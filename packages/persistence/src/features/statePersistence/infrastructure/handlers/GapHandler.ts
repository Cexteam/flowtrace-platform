/**
 * GapHandler - IPC message handler for gap record operations
 * Handles gap/save, gap/load, gap/mark_synced actions.
 * Delegates to GapPersistencePort (inbound port) for business logic.
 * Validates incoming data with Zod schemas.
 */

import { injectable, inject } from 'inversify';
import { z } from 'zod';
import {
  GapRecordInputDTOSchema,
  type GapMessage,
  type GapResponse,
  type GapSavePayload,
  type GapLoadPayload,
  type GapMarkSyncedPayload,
} from '@flowtrace/ipc';
import type { GapPersistencePort } from '../../application/ports/in/GapPersistencePort.js';
import { STATE_PERSISTENCE_TYPES } from '../../di/types.js';

// Zod schemas for payload validation
const GapSavePayloadSchema = z.object({
  action: z.literal('gap_save'),
  gap: GapRecordInputDTOSchema,
});

const GapLoadPayloadSchema = z.object({
  action: z.literal('gap_load'),
  exchange: z.string().min(1).optional(),
  symbol: z.string().min(1).optional(),
  syncedOnly: z.boolean().optional(),
});

const GapMarkSyncedPayloadSchema = z.object({
  action: z.literal('gap_mark_synced'),
  gapIds: z.array(z.number().int().positive()),
});

import { LOGGER_TYPES } from '../../../../infrastructure/logger/di/module.js';

/**
 * Handler for gap record IPC messages
 */
@injectable()
export class GapHandler {
  constructor(
    @inject(STATE_PERSISTENCE_TYPES.GapPersistencePort)
    private readonly gapPersistence: GapPersistencePort,
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
      (message as { type: string }).type === 'gap'
    );
  }

  /**
   * Handle a gap message
   */
  async handle(message: GapMessage): Promise<GapResponse> {
    this.logger.info('[GapHandler] Received message', { type: message.type });
    const { payload } = message;

    if (!payload || typeof payload !== 'object' || !('action' in payload)) {
      this.logger.warn('[GapHandler] Invalid payload: missing action');
      return { success: false, error: 'Invalid payload: missing action' };
    }

    const action = (payload as { action: string }).action;
    this.logger.info('[GapHandler] Processing action', { action });

    try {
      switch (action) {
        case 'gap_save':
          return await this.handleSave(payload as GapSavePayload);
        case 'gap_load':
          return await this.handleLoad(payload as GapLoadPayload);
        case 'gap_mark_synced':
          return await this.handleMarkSynced(payload as GapMarkSyncedPayload);
        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.error('Gap message validation failed', error, {
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

      this.logger.error('Gap handler error', error, { action });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle gap/save action
   */
  private async handleSave(payload: GapSavePayload): Promise<GapResponse> {
    const validated = GapSavePayloadSchema.parse(payload);
    await this.gapPersistence.saveGap({ gap: validated.gap });
    return { success: true };
  }

  /**
   * Handle gap/load action
   */
  private async handleLoad(payload: GapLoadPayload): Promise<GapResponse> {
    this.logger.info('[GapHandler] handleLoad called', { payload });
    const validated = GapLoadPayloadSchema.parse(payload);
    const result = await this.gapPersistence.loadGaps({
      options: {
        exchange: validated.exchange,
        symbol: validated.symbol,
        syncedOnly: validated.syncedOnly,
      },
    });
    this.logger.info('[GapHandler] loadGaps result', {
      gapsCount: result.gaps.length,
    });
    return { success: true, data: { gaps: result.gaps } };
  }

  /**
   * Handle gap/mark_synced action
   */
  private async handleMarkSynced(
    payload: GapMarkSyncedPayload
  ): Promise<GapResponse> {
    const validated = GapMarkSyncedPayloadSchema.parse(payload);
    await this.gapPersistence.markGapsSynced({ gapIds: validated.gapIds });
    return { success: true };
  }
}
