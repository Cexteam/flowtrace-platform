/**
 * MessageRouter - Centralized IPC message routing
 * Routes incoming IPC messages to the appropriate feature handler
 * based on message.type field.
 */

import { injectable, inject, optional } from 'inversify';
import type { MessageHandler, MessageHandlerResponse } from './types.js';
import { LOGGER_TYPES } from '../logger/di/types.js';
import { MESSAGE_ROUTER_TYPES } from './di/types.js';

@injectable()
export class MessageRouter {
  private readonly handlers: Map<string, MessageHandler> = new Map();

  constructor(
    @inject(LOGGER_TYPES.Logger) private readonly logger: any,
    @inject(MESSAGE_ROUTER_TYPES.CandleHandler)
    @optional()
    candleHandler?: MessageHandler,
    @inject(MESSAGE_ROUTER_TYPES.StateHandler)
    @optional()
    stateHandler?: MessageHandler,
    @inject(MESSAGE_ROUTER_TYPES.GapHandler)
    @optional()
    gapHandler?: MessageHandler
  ) {
    // Register handlers if provided
    if (candleHandler) {
      this.handlers.set('candle', candleHandler);
      // Also handle candle:complete messages (sent by HybridEventPublisher)
      this.handlers.set('candle:complete', candleHandler);
    }
    if (stateHandler) {
      this.handlers.set('state', stateHandler);
    }
    if (gapHandler) {
      this.handlers.set('gap', gapHandler);
    }
  }

  /**
   * Register a handler for a specific message type
   *
   * @param type - The message type to handle
   * @param handler - The handler to register
   */
  registerHandler(type: string, handler: MessageHandler): void {
    this.handlers.set(type, handler);
    this.logger.debug('Registered handler for message type', { type });
  }

  /**
   * Route a message to the appropriate handler
   *
   * @param message - The incoming message
   * @returns Promise resolving to the handler response
   *
   */
  async route(message: unknown): Promise<MessageHandlerResponse> {
    // Validate message structure
    if (!this.isValidMessage(message)) {
      this.logger.warn('Invalid message structure received', { message });
      return {
        success: false,
        error: 'Invalid message: missing or invalid type field',
      };
    }

    const messageType = (message as { type: string }).type;

    // Find handler for this message type
    const handler = this.handlers.get(messageType);

    if (!handler) {
      this.logger.warn('No handler found for message type', {
        type: messageType,
      });
      return {
        success: false,
        error: `Unknown message type: ${messageType}`,
      };
    }

    try {
      this.logger.debug('Routing message to handler', { type: messageType });
      const response = await handler.handle(message);
      return response;
    } catch (error) {
      this.logger.error('Handler error', error, { type: messageType });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown handler error',
      };
    }
  }

  /**
   * Check if a message has valid structure
   */
  private isValidMessage(message: unknown): boolean {
    return (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      typeof (message as { type: unknown }).type === 'string'
    );
  }

  /**
   * Get list of registered message types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}
