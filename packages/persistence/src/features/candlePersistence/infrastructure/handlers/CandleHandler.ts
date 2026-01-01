/**
 * CandleHandler - IPC message handler for candle persistence operations
 * Handles candle messages from Unix Socket and SQLite Queue.
 * Validates message schema and delegates to CandlePersistencePort.
 * This handler replaces the MessageConsumer for candle-specific messages,
 * following the same pattern as StateHandler and GapHandler.
 */

import { injectable, inject } from 'inversify';
import { validateQueueMessageDTO } from '@flowtrace/ipc';
import { FootprintCandle, FootprintCandleDTO } from '@flowtrace/core';
import { z } from 'zod';
import type { CandlePersistencePort } from '../../application/ports/in/CandlePersistencePort.js';
import type {
  MessageHandler,
  MessageHandlerResponse,
} from '../../../../infrastructure/ipc/types.js';
import { CANDLE_PERSISTENCE_TYPES } from '../../di/types.js';
import { LOGGER_TYPES } from '../../../../infrastructure/logger/di/module.js';

/**
 * Handler for candle persistence IPC messages
 */
@injectable()
export class CandleHandler implements MessageHandler {
  constructor(
    @inject(CANDLE_PERSISTENCE_TYPES.CandlePersistencePort)
    private readonly candlePersistence: CandlePersistencePort,
    @inject(LOGGER_TYPES.Logger)
    private readonly logger: any
  ) {}

  /**
   * Check if this handler can handle the given message
   */
  canHandle(message: unknown): boolean {
    if (
      typeof message !== 'object' ||
      message === null ||
      !('type' in message)
    ) {
      return false;
    }
    const type = (message as { type: string }).type;
    // Handle both 'candle' and 'candle:complete' message types
    return type === 'candle' || type === 'candle:complete';
  }

  /**
   * Handle a candle message
   *
   * @param message - The candle message to handle
   * @returns Promise resolving to the handler response
   */
  async handle(message: unknown): Promise<MessageHandlerResponse> {
    try {
      // Step 1: Validate message schema using Zod
      const validatedMessage = validateQueueMessageDTO(message);

      // Step 2: Parse payload to FootprintCandle
      const candle = FootprintCandle.fromJSON(
        validatedMessage.payload as FootprintCandleDTO
      );

      // Step 3: Use the port to persist (includes validation)
      const result = await this.candlePersistence.persistCandle({
        candle,
        source: 'unix-socket', // Default to unix-socket for MessageRouter
        messageId: validatedMessage.id,
      });

      // this.logger.info('Candle persisted successfully', {
      //   messageId: validatedMessage.id,
      //   candleId: result.candleId,
      //   persistedAt: result.persistedAt,
      // });

      return {
        success: true,
        data: {
          candleId: result.candleId,
          persistedAt: result.persistedAt,
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Schema validation error - log and return error
        this.logger.error('Candle message schema validation failed', error, {
          errors: error.errors,
          message,
        });
        return {
          success: false,
          error: `Validation failed: ${error.errors
            .map((e) => e.message)
            .join(', ')}`,
        };
      }

      // Other errors (storage, validation, etc.)
      this.logger.error('Failed to process candle message', error, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
