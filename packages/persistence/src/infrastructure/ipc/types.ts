/**
 * IPC Infrastructure Types
 * Defines interfaces for IPC infrastructure components.
 * These are runtime configuration and handler interfaces, not DTOs.
 */

/**
 * Poller configuration for RuntimeDatabasePoller
 * Used to configure the polling behavior of the queue poller.
 */
export interface PollerConfigValues {
  /**
   * Polling interval in milliseconds
   */
  pollInterval: number;

  /**
   * Batch size for queue processing
   */
  batchSize: number;
}

/**
 * Response from a message handler
 */
export interface MessageHandlerResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Interface for IPC message handlers
 * Each feature (candle, state, gap) implements this interface
 * to handle its specific message types.
 */
export interface MessageHandler {
  /**
   * Check if this handler can handle the given message
   *
   * @param message - The incoming message
   * @returns true if this handler can process the message
   */
  canHandle(message: unknown): boolean;

  /**
   * Handle the message and return a response
   *
   * @param message - The message to handle
   * @returns Promise resolving to the handler response
   */
  handle(message: unknown): Promise<MessageHandlerResponse>;
}

/**
 * Message type identifiers for routing
 */
export type MessageType = 'candle' | 'state' | 'gap';

/**
 * Base message structure for IPC communication
 */
export interface IPCMessage {
  type: MessageType;
  payload?: unknown;
}
