import { injectable } from 'inversify';
import { createLogger } from '../../../../shared/lib/logger/logger.js';
import WebSocket from 'ws';

const logger = createLogger('WebSocketManager');

/**
 * WebSocket Manager
 *
 * Features:
 * - Connection lifecycle management
 * - Auto-reconnection with exponential backoff
 * - Ping/pong heartbeats
 * - Message parsing and error handling
 * - Connection state tracking
 *
 * Config (URLs, reconnect settings) passed from adapter, loaded from database.
 */
@injectable()
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private isReconnecting = false;
  private reconnectAttempts = 0;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private onReconnectCallback?: () => Promise<void>;

  constructor(
    private url: string,
    private reconnectDelay = 5000,
    private maxDelay = 60000,
    private maxReconnectAttempts = 300
  ) {
    // Register default error handler
    this.registerMessageHandler('error', (error) => {
      logger.error('WebSocket error received', error);
    });

    // Register default ping handler
    this.registerMessageHandler('ping', (data) => {
      logger.debug('Received pong from server');
    });
  }

  /**
   * Connect to WebSocket endpoint
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.warn('WebSocket already connected');
      return;
    }

    this.isReconnecting = false;
    this.reconnectAttempts = 0;

    await this.establishConnection();
  }

  /**
   * Disconnect from WebSocket endpoint
   */
  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.ws) {
      // Send close frame gracefully
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }

    logger.info('WebSocket disconnected');
  }

  /**
   * Send message to WebSocket server
   */
  async send(message: any): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket not connected');
    }

    try {
      const messageStr = JSON.stringify(message);
      this.ws.send(messageStr);
      logger.debug(
        `Send message: ${messageStr.substring(0, 100)}${
          messageStr.length > 100 ? '...' : ''
        }`
      );
    } catch (error) {
      logger.error('Failed to send message', error);
      throw error;
    }
  }

  /**
   * Register message handler for specific message types
   */
  registerMessageHandler(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
    logger.debug(`Registered handler for message type: ${type}`);
  }

  /**
   * Set callback to be called after successful reconnection
   * Used to re-subscribe to streams after WebSocket reconnects
   */
  setOnReconnect(callback: () => Promise<void>): void {
    this.onReconnectCallback = callback;
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      isReconnecting: this.isReconnecting,
      reconnectAttempts: this.reconnectAttempts,
      url: this.url,
    };
  }

  /**
   * Establish WebSocket connection with retry logic
   */
  private async establishConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        logger.info(`Connecting to WebSocket: ${this.url}`);

        const headers: any = {};
        // Add API key headers if available
        // if (env.BINANCE_API_KEY) {
        //   headers['X-MBX-APIKEY'] = env.BINANCE_API_KEY;
        // }

        this.ws = new WebSocket(this.url, { headers });

        this.ws.on('open', () => {
          this.isConnected = true;
          this.isReconnecting = false;
          this.reconnectAttempts = 0;

          logger.info('WebSocket connection established');

          // Start heartbeat
          this.startHeartbeat();

          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error) => {
          logger.error('WebSocket connection error', error);
          this.isConnected = false;

          // Don't reject here - let reconnection logic handle
          if (!this.isReconnecting) {
            reject(error);
          }
        });

        this.ws.on('close', (code, reason) => {
          logger.warn(`WebSocket closed - Code: ${code}, Reason: ${reason}`);
          this.isConnected = false;

          // Don't try to reconnect during normal shutdown
          if (code !== 1000 && !this.isReconnecting) {
            this.scheduleReconnect();
          }
        });

        this.ws.on('ping', () => {
          logger.debug('Received ping from server');
          // WebSocket library handles pong automatically
        });

        this.ws.on('pong', () => {
          logger.debug('Received pong from server');
        });
      } catch (error) {
        logger.error('Failed to establish connection', error);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      // Check if it's an error message
      if (message.error) {
        this.messageHandlers.get('error')?.(message);
        return;
      }

      // Check for stream type (multiple streams)
      if (message.stream && message.data) {
        // Handle combined streams: e.g., "btcusdt@trade"
        const streamName = message.stream;
        this.messageHandlers.get('stream')?.({
          ...message.data,
          stream: streamName,
        });
      }
      // Check for stream type (multiple streams)
      if (message.trade && message.data) {
        // Handle combined streams: e.g., "btcusdt@trade"
        const tradeName = message.e;
        this.messageHandlers.get('trade')?.({
          ...message.data,
          trade: tradeName,
        });
      }
      // Handle direct messages (single stream or other types)
      else if (message.e) {
        // Message has event type (trade, etc.)
        this.messageHandlers.get(message.e)?.(message);
      } else {
        // Handle by message type or generic handler
        this.messageHandlers.get('message')?.(message);
      }
    } catch (error) {
      logger.error('Failed to parse WebSocket message', {
        data: data.toString().substring(0, 200),
        error,
      });
      this.messageHandlers.get('error')?.({
        error: (error as Error).message,
        rawData: data,
      });
    }
  }

  /**
   * Start heartbeat/ping mechanism (required by Binance)
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws) {
        try {
          this.ws.ping();
        } catch (error) {
          logger.error('Failed to send heartbeat ping', error);
        }
      }
    }, 60000); // Every 60 seconds (Binance requirement)

    logger.debug('Heartbeat mechanism started');
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.isReconnecting) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(
        `Max reconnection attempts (${this.maxReconnectAttempts}) exceeded`
      );
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // Exponential backoff with jitter
    const baseDelay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxDelay
    );
    const jitter = Math.random() * 1000; // Up to 1 second jitter
    const delay = baseDelay + jitter;

    logger.info(
      `Scheduling reconnection attempt ${this.reconnectAttempts}/${
        this.maxReconnectAttempts
      } in ${(delay / 1000).toFixed(1)}s`
    );

    setTimeout(async () => {
      try {
        await this.establishConnection();

        // Call reconnect callback to re-subscribe to streams
        if (this.onReconnectCallback) {
          logger.info('Calling reconnect callback to re-subscribe streams...');
          await this.onReconnectCallback();
        }
      } catch (error) {
        logger.error(
          `Reconnection attempt ${this.reconnectAttempts} failed`,
          error
        );
        this.isReconnecting = false;
        this.scheduleReconnect(); // Retry again
      }
    }, delay);
  }
}
