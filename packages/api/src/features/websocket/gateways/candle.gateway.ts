/**
 * CandleGateway - WebSocket gateway for real-time candle streaming
 *
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Logger, Optional } from '@nestjs/common';
import { BRIDGE_TOKENS } from '../../../bridge/index.js';
import type { ICache } from '@flowtrace/core';

interface SubscribePayload {
  symbol: string;
  timeframe?: string;
}

interface UnsubscribePayload {
  symbol: string;
  timeframe?: string;
}

interface CandleMessage {
  symbol: string;
  timeframe: string;
  candle: {
    openTime: number;
    closeTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    buyVolume?: number;
    sellVolume?: number;
  };
}

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/ws',
  transports: ['websocket', 'polling'],
})
export class CandleGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CandleGateway.name);

  // Track subscriptions per client
  private clientSubscriptions = new Map<string, Set<string>>();

  // Cache unsubscribe function
  private cacheUnsubscribe: (() => void) | null = null;

  constructor(
    @Optional()
    @Inject(BRIDGE_TOKENS.CACHE)
    private readonly cache: ICache | null
  ) {}

  afterInit(_server: Server): void {
    this.logger.log('WebSocket Gateway initialized');

    // Subscribe to cache pub/sub for candle updates
    this.setupCacheSubscription();
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
    this.clientSubscriptions.set(client.id, new Set());

    // Send welcome message
    client.emit('connected', {
      message: 'Connected to FlowTrace WebSocket',
      clientId: client.id,
      timestamp: Date.now(),
    });
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Clean up subscriptions
    const subscriptions = this.clientSubscriptions.get(client.id);
    if (subscriptions) {
      subscriptions.forEach((room) => {
        client.leave(room);
      });
    }
    this.clientSubscriptions.delete(client.id);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscribePayload
  ): {
    event: string;
    data: { symbol: string; timeframe?: string; subscribed: boolean };
  } {
    const { symbol, timeframe } = payload;

    if (!symbol) {
      return {
        event: 'error',
        data: { symbol: '', subscribed: false },
      };
    }

    // Create room name based on symbol and optional timeframe
    const room = timeframe
      ? `candle:${symbol}:${timeframe}`
      : `candle:${symbol}`;

    // Join the room
    client.join(room);

    // Track subscription
    const subscriptions = this.clientSubscriptions.get(client.id);
    if (subscriptions) {
      subscriptions.add(room);
    }

    this.logger.log(`Client ${client.id} subscribed to ${room}`);

    return {
      event: 'subscribed',
      data: { symbol, timeframe, subscribed: true },
    };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: UnsubscribePayload
  ): {
    event: string;
    data: { symbol: string; timeframe?: string; unsubscribed: boolean };
  } {
    const { symbol, timeframe } = payload;

    if (!symbol) {
      return {
        event: 'error',
        data: { symbol: '', unsubscribed: false },
      };
    }

    const room = timeframe
      ? `candle:${symbol}:${timeframe}`
      : `candle:${symbol}`;

    // Leave the room
    client.leave(room);

    // Remove from tracking
    const subscriptions = this.clientSubscriptions.get(client.id);
    if (subscriptions) {
      subscriptions.delete(room);
    }

    this.logger.log(`Client ${client.id} unsubscribed from ${room}`);

    return {
      event: 'unsubscribed',
      data: { symbol, timeframe, unsubscribed: true },
    };
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() _client: Socket): {
    event: string;
    data: { timestamp: number };
  } {
    return {
      event: 'pong',
      data: { timestamp: Date.now() },
    };
  }

  /**
   * Broadcast a candle update to all subscribed clients
   */
  broadcastCandle(message: CandleMessage): void {
    const { symbol, timeframe, candle } = message;

    // Broadcast to symbol-specific room
    const symbolRoom = `candle:${symbol}`;
    this.server.to(symbolRoom).emit('candle', {
      symbol,
      timeframe,
      candle,
      timestamp: Date.now(),
    });

    // Also broadcast to timeframe-specific room
    const timeframeRoom = `candle:${symbol}:${timeframe}`;
    this.server.to(timeframeRoom).emit('candle', {
      symbol,
      timeframe,
      candle,
      timestamp: Date.now(),
    });
  }

  /**
   * Setup subscription to cache pub/sub for candle updates
   */
  private async setupCacheSubscription(): Promise<void> {
    if (!this.cache) {
      this.logger.warn(
        'Cache not available, WebSocket will not receive candle updates from cache'
      );
      return;
    }

    try {
      // Subscribe to candle updates pattern
      this.cacheUnsubscribe = await this.cache.psubscribe(
        'candle:*',
        (channel: string, message: unknown) => {
          this.handleCacheMessage(channel, message);
        }
      );

      this.logger.log('Subscribed to cache candle updates');
    } catch (error) {
      this.logger.error('Failed to subscribe to cache', error);
    }
  }

  /**
   * Handle messages from cache pub/sub
   */
  private handleCacheMessage(channel: string, message: unknown): void {
    try {
      // Parse channel to extract symbol and timeframe
      // Expected format: candle:BTCUSDT:1m
      const parts = channel.split(':');
      if (parts.length < 2) {
        return;
      }

      const symbol = parts[1];
      const timeframe = parts[2] ?? '1m';

      // Parse message
      const candleData =
        typeof message === 'string' ? JSON.parse(message) : message;

      this.broadcastCandle({
        symbol: symbol ?? '',
        timeframe,
        candle: candleData as CandleMessage['candle'],
      });
    } catch (error) {
      this.logger.error('Failed to handle cache message', error);
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    if (this.cacheUnsubscribe) {
      this.cacheUnsubscribe();
    }
  }
}
