/**
 * Domain types for Unix Socket IPC
 */

/**
 * Configuration for UnixSocketClient
 */
export interface UnixSocketClientConfig {
  socketPath: string;
  connectTimeout?: number;
  reconnectDelay?: number;
}

/**
 * Configuration for UnixSocketServer
 */
export interface UnixSocketServerConfig {
  socketPath: string;
  maxConnections?: number;
}

/**
 * Message handler function type (fire-and-forget)
 */
export type MessageHandler = (message: unknown) => Promise<void> | void;

/**
 * Request/Response handler function type
 * Returns a response object that will be sent back to the client
 */
export type RequestResponseHandler = (
  message: unknown
) => Promise<unknown> | unknown;
