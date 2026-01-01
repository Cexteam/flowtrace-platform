/**
 * Unix Socket Server for IPC
 *
 * Listens for incoming connections and processes messages from clients.
 * This is the receiving end of the primary communication channel.
 *
 * Supports two modes:
 * 1. Fire-and-forget: setMessageHandler() - handler returns void
 * 2. Request/Response: setRequestHandler() - handler returns response to send back
 */

import * as net from 'net';
import * as fs from 'fs';
import type {
  UnixSocketServerConfig,
  MessageHandler,
  RequestResponseHandler,
} from './types.js';

export class UnixSocketServer {
  private server: net.Server | null = null;
  private listening: boolean = false;
  private readonly socketPath: string;
  private readonly maxConnections: number;
  private messageHandler: MessageHandler | null = null;
  private requestHandler: RequestResponseHandler | null = null;

  constructor(config: UnixSocketServerConfig) {
    this.socketPath = config.socketPath;
    this.maxConnections = config.maxConnections ?? 100;
  }

  /**
   * Set the message handler function (fire-and-forget mode)
   */
  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * Set the request handler function (request/response mode)
   * Handler should return a response object that will be sent back to client
   */
  setRequestHandler(handler: RequestResponseHandler): void {
    this.requestHandler = handler;
  }

  /**
   * Start the Unix socket server
   */
  async start(): Promise<void> {
    if (this.listening) {
      throw new Error('Server is already listening');
    }

    // Remove existing socket file if it exists
    if (fs.existsSync(this.socketPath)) {
      fs.unlinkSync(this.socketPath);
    }

    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.maxConnections = this.maxConnections;

      this.server.on('error', (error) => {
        this.listening = false;
        reject(error);
      });

      this.server.listen(this.socketPath, () => {
        this.listening = true;
        resolve();
      });
    });
  }

  /**
   * Stop the Unix socket server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server!.close((error) => {
        if (error) {
          reject(error);
        } else {
          this.listening = false;
          this.server = null;

          // Clean up socket file
          if (fs.existsSync(this.socketPath)) {
            fs.unlinkSync(this.socketPath);
          }

          resolve();
        }
      });
    });
  }

  /**
   * Check if the server is listening
   */
  isListening(): boolean {
    return this.listening;
  }

  /**
   * Handle incoming connection
   */
  private handleConnection(socket: net.Socket): void {
    let buffer = Buffer.alloc(0);

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);

      // Process all complete messages in the buffer
      while (buffer.length >= 4) {
        const messageLength = buffer.readUInt32BE(0);

        // Check if we have the complete message
        if (buffer.length >= 4 + messageLength) {
          const messageBuffer = buffer.subarray(4, 4 + messageLength);
          buffer = buffer.subarray(4 + messageLength);

          try {
            const message = JSON.parse(messageBuffer.toString());
            this.processMessage(message, socket);
          } catch (error) {
            console.error('Failed to parse message:', error);
          }
        } else {
          // Wait for more data
          break;
        }
      }
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    socket.on('close', () => {
      // Connection closed
    });
  }

  /**
   * Process a received message
   * If requestHandler is set, sends response back to client
   */
  private async processMessage(
    message: unknown,
    socket: net.Socket
  ): Promise<void> {
    // Extract message id for response correlation
    const messageId =
      typeof message === 'object' && message !== null && 'id' in message
        ? (message as { id: string }).id
        : null;

    // Try request/response handler first (if set)
    if (this.requestHandler) {
      try {
        const response = await this.requestHandler(message);

        // Send response back to client if we have a message id
        if (messageId && response !== undefined && socket.writable) {
          const responseWithId = { id: messageId, ...response };
          this.sendResponse(socket, responseWithId);
        }
        return;
      } catch (error) {
        console.error('Error in request handler:', error);
        // Send error response if we have a message id
        if (messageId && socket.writable) {
          const errorResponse = {
            id: messageId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
          this.sendResponse(socket, errorResponse);
        }
        return;
      }
    }

    // Fall back to fire-and-forget handler
    if (this.messageHandler) {
      try {
        await this.messageHandler(message);
      } catch (error) {
        console.error('Error processing message:', error);
      }
      return;
    }

    console.warn('No message handler set, message ignored');
  }

  /**
   * Send response back to client with length prefix
   */
  private sendResponse(socket: net.Socket, response: unknown): void {
    try {
      const json = JSON.stringify(response);
      const length = Buffer.byteLength(json);
      const header = Buffer.alloc(4);
      header.writeUInt32BE(length, 0);
      socket.write(Buffer.concat([header, Buffer.from(json)]));
    } catch (error) {
      console.error('Failed to send response:', error);
    }
  }
}
