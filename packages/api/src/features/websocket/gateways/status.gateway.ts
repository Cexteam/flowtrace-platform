/**
 * StatusGateway - WebSocket gateway for real-time status updates
 *
 * Provides real-time updates for:
 * - Worker status changes (worker:status channel)
 * - Symbol status changes (symbol:status channel)
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
import type { WorkerPoolPort, WorkerHealthMonitorPort } from '@flowtrace/core';

/**
 * Worker status update message
 */
interface WorkerStatusMessage {
  workerId: string;
  state: string;
  isReady: boolean;
  symbolCount: number;
  healthMetrics?: {
    totalTradesProcessed: number;
    eventsPublished: number;
    averageProcessingTimeMs: number;
    memoryUsageBytes: number;
    errorCount: number;
  };
  timestamp: number;
}

/**
 * Symbol status update message
 */
interface SymbolStatusMessage {
  symbolId: string;
  symbol: string;
  exchange: string;
  status: string;
  isStreaming?: boolean;
  isProcessing?: boolean;
  workerId?: string;
  timestamp: number;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/ws/status',
  transports: ['websocket', 'polling'],
})
export class StatusGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(StatusGateway.name);

  // Track subscriptions per client
  private clientSubscriptions = new Map<string, Set<string>>();

  // Polling interval for worker status updates
  private workerStatusInterval?: NodeJS.Timeout;
  private readonly WORKER_STATUS_INTERVAL_MS = 5000; // 5 seconds

  constructor(
    @Optional()
    @Inject(BRIDGE_TOKENS.WORKER_POOL_PORT)
    private readonly workerPoolPort: WorkerPoolPort | null,
    @Optional()
    @Inject(BRIDGE_TOKENS.WORKER_HEALTH_MONITOR_PORT)
    private readonly workerHealthMonitorPort: WorkerHealthMonitorPort | null
  ) {}

  afterInit(_server: Server): void {
    this.logger.log('Status WebSocket Gateway initialized');

    // Start periodic worker status updates
    this.startWorkerStatusPolling();
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected to status gateway: ${client.id}`);
    this.clientSubscriptions.set(client.id, new Set());

    // Send welcome message
    client.emit('connected', {
      message: 'Connected to FlowTrace Status WebSocket',
      clientId: client.id,
      availableChannels: ['worker:status', 'symbol:status'],
      timestamp: Date.now(),
    });
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected from status gateway: ${client.id}`);

    // Clean up subscriptions
    const subscriptions = this.clientSubscriptions.get(client.id);
    if (subscriptions) {
      subscriptions.forEach((room) => {
        client.leave(room);
      });
    }
    this.clientSubscriptions.delete(client.id);
  }

  @SubscribeMessage('subscribe:worker')
  handleSubscribeWorker(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: { workerId?: string }
  ): {
    event: string;
    data: {
      channel: string;
      subscribed: boolean;
      filter?: { workerId?: string };
    };
  } {
    const room = payload?.workerId
      ? `worker:status:${payload.workerId}`
      : 'worker:status';

    // Join the room
    client.join(room);

    // Track subscription
    const subscriptions = this.clientSubscriptions.get(client.id);
    if (subscriptions) {
      subscriptions.add(room);
    }

    this.logger.log(`Client ${client.id} subscribed to ${room}`);

    // Send initial worker status
    this.sendInitialWorkerStatus(client, payload?.workerId);

    return {
      event: 'subscribed',
      data: {
        channel: 'worker:status',
        subscribed: true,
        filter: payload?.workerId ? { workerId: payload.workerId } : undefined,
      },
    };
  }

  @SubscribeMessage('subscribe:symbol')
  handleSubscribeSymbol(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: { symbolId?: string; exchange?: string }
  ): {
    event: string;
    data: {
      channel: string;
      subscribed: boolean;
      filter?: { symbolId?: string; exchange?: string };
    };
  } {
    let room = 'symbol:status';
    if (payload?.symbolId) {
      room = `symbol:status:${payload.symbolId}`;
    } else if (payload?.exchange) {
      room = `symbol:status:exchange:${payload.exchange}`;
    }

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
      data: {
        channel: 'symbol:status',
        subscribed: true,
        filter: payload,
      },
    };
  }

  @SubscribeMessage('unsubscribe:worker')
  handleUnsubscribeWorker(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: { workerId?: string }
  ): {
    event: string;
    data: { channel: string; unsubscribed: boolean };
  } {
    const room = payload?.workerId
      ? `worker:status:${payload.workerId}`
      : 'worker:status';

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
      data: { channel: 'worker:status', unsubscribed: true },
    };
  }

  @SubscribeMessage('unsubscribe:symbol')
  handleUnsubscribeSymbol(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: { symbolId?: string; exchange?: string }
  ): {
    event: string;
    data: { channel: string; unsubscribed: boolean };
  } {
    let room = 'symbol:status';
    if (payload?.symbolId) {
      room = `symbol:status:${payload.symbolId}`;
    } else if (payload?.exchange) {
      room = `symbol:status:exchange:${payload.exchange}`;
    }

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
      data: { channel: 'symbol:status', unsubscribed: true },
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
   * Broadcast worker status update
   */
  broadcastWorkerStatus(message: WorkerStatusMessage): void {
    // Broadcast to general worker:status room
    this.server.to('worker:status').emit('worker:status', message);

    // Also broadcast to worker-specific room
    this.server
      .to(`worker:status:${message.workerId}`)
      .emit('worker:status', message);
  }

  /**
   * Broadcast symbol status update
   */
  broadcastSymbolStatus(message: SymbolStatusMessage): void {
    // Broadcast to general symbol:status room
    this.server.to('symbol:status').emit('symbol:status', message);

    // Also broadcast to symbol-specific room
    this.server
      .to(`symbol:status:${message.symbolId}`)
      .emit('symbol:status', message);

    // Also broadcast to exchange-specific room
    this.server
      .to(`symbol:status:exchange:${message.exchange}`)
      .emit('symbol:status', message);
  }

  /**
   * Send initial worker status to a newly subscribed client
   */
  private sendInitialWorkerStatus(client: Socket, workerId?: string): void {
    if (!this.workerPoolPort) {
      return;
    }

    try {
      const status = this.workerPoolPort.getStatus();

      if (workerId) {
        // Send specific worker status
        const worker = status.workers.find((w) => w.workerId === workerId);
        if (worker) {
          const workerJson = worker.toJSON();
          client.emit('worker:status:initial', {
            workers: [this.transformWorkerToMessage(workerJson)],
            timestamp: Date.now(),
          });
        }
      } else {
        // Send all workers status
        const workerMessages = status.workers.map((w) =>
          this.transformWorkerToMessage(w.toJSON())
        );
        client.emit('worker:status:initial', {
          workers: workerMessages,
          totalWorkers: status.totalWorkers,
          healthyWorkers: status.healthyWorkers,
          readyWorkers: status.readyWorkers,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      this.logger.error('Failed to send initial worker status', error);
    }
  }

  /**
   * Transform worker JSON to status message
   */
  private transformWorkerToMessage(
    workerJson: Record<string, unknown>
  ): WorkerStatusMessage {
    const healthMetrics = workerJson.healthMetrics as
      | Record<string, unknown>
      | undefined;

    return {
      workerId: workerJson.workerId as string,
      state: workerJson.state as string,
      isReady: workerJson.isReady as boolean,
      symbolCount: (workerJson.assignedSymbols as string[])?.length ?? 0,
      healthMetrics: healthMetrics
        ? {
            totalTradesProcessed:
              (healthMetrics.totalTradesProcessed as number) ?? 0,
            eventsPublished: (healthMetrics.eventsPublished as number) ?? 0,
            averageProcessingTimeMs:
              (healthMetrics.averageProcessingTimeMs as number) ?? 0,
            memoryUsageBytes: (healthMetrics.memoryUsageBytes as number) ?? 0,
            errorCount: (healthMetrics.errorCount as number) ?? 0,
          }
        : undefined,
      timestamp: Date.now(),
    };
  }

  /**
   * Start periodic worker status polling
   */
  private startWorkerStatusPolling(): void {
    this.workerStatusInterval = setInterval(() => {
      this.pollAndBroadcastWorkerStatus();
    }, this.WORKER_STATUS_INTERVAL_MS);

    this.logger.log(
      `Started worker status polling every ${this.WORKER_STATUS_INTERVAL_MS}ms`
    );
  }

  /**
   * Poll worker status and broadcast updates
   */
  private pollAndBroadcastWorkerStatus(): void {
    if (!this.workerPoolPort) {
      return;
    }

    try {
      const status = this.workerPoolPort.getStatus();

      // Broadcast each worker's status
      for (const worker of status.workers) {
        const workerJson = worker.toJSON();
        this.broadcastWorkerStatus(this.transformWorkerToMessage(workerJson));
      }
    } catch (error) {
      this.logger.error('Failed to poll worker status', error);
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    if (this.workerStatusInterval) {
      clearInterval(this.workerStatusInterval);
    }
  }
}
