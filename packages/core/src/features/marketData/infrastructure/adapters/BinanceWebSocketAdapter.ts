/**
 * BinanceWebSocketAdapter
 *
 * Receives trades from Binance WebSocket and forwards them to workers.
 * Exchange config (URLs, reconnect settings) loaded via ExchangeConfigPort.
 *
 * Zero-Gap Reconnection:
 * - Uses ConnectionRotator for proactive dual-connection strategy
 * - Deduplication handled by ProcessTradeUseCase in worker thread
 * - Ensures no trade gaps when Binance disconnects after 24h
 *
 * Hexagonal Architecture:
 * - Implements Port Out (TradeStreamPort)
 * - Uses Port Out (ExchangeConfigPort) for cross-feature config access
 */

import { injectable, inject } from 'inversify';
import {
  Trade,
  Trades,
} from '../../../candleProcessing/domain/value-objects/TradeData.js';
import _ from 'lodash';
const { cloneDeep } = _;
import { TradeStreamPort } from '../../application/ports/out/TradeStreamPort.js';
import type {
  ExchangeConfigPort,
  ExchangeConfig,
} from '../../application/ports/out/ExchangeConfigPort.js';
import { WebSocketConnectionStatus } from '../../domain/types/index.js';
import { MARKET_DATA_TYPES } from '../../../../shared/lib/di/bindings/features/marketData/types.js';
import { WebSocketManager } from '../services/index.js';
import {
  ConnectionRotator,
  WebSocketManagerFactory,
} from '../services/ConnectionRotator.js';
import { getRotationConfig } from '../services/RotationConfig.js';
import { createLogger } from '../../../../shared/lib/logger/logger.js';

const logger = createLogger('BinanceWsTradeStreamAdapter');

/**
 * Extended WebSocket connection status with rotation info
 */
export interface ExtendedWebSocketConnectionStatus
  extends WebSocketConnectionStatus {
  rotationEnabled: boolean;
  isRotating: boolean;
  connectionAge: number;
  nextRotationTime: number | null;
  rotationCount: number;
  failedRotationCount: number;
  secondaryConnectionStatus?: {
    isConnected: boolean;
    connectionAge: number;
  };
}

/**
 * BinanceWsTradeStreamAdapter
 *
 * Receives trades from Binance WebSocket and forwards them to workers.
 * Uses ConnectionRotator for zero-gap reconnection strategy.
 * Deduplication is handled in worker thread by ProcessTradeUseCase.
 */
@injectable()
export class BinanceWsTradeStreamAdapter implements TradeStreamPort {
  private activeSymbols: string[] = [];
  private tradeCallback?: (trades: Trades[]) => void;
  private connectionRotator?: ConnectionRotator;

  // Cached exchange config (lazy loaded)
  private exchangeConfig: ExchangeConfig | null = null;

  // Trade buffer for batching (kept for sequential processing)
  private tradeBuffer = new Map<string, Trade[]>();

  // Processing flags per symbol
  private processingSymbols = new Set<string>();

  constructor(
    @inject(MARKET_DATA_TYPES.ExchangeConfigPort)
    private exchangeConfigPort: ExchangeConfigPort
  ) {}

  /**
   * Get exchange config (lazy loading with cache)
   */
  private async getExchangeConfig(): Promise<ExchangeConfig> {
    if (!this.exchangeConfig) {
      this.exchangeConfig = await this.exchangeConfigPort.getExchangeConfig(
        'binance'
      );
      if (!this.exchangeConfig) {
        throw new Error('Binance exchange config not found in database');
      }
      logger.info('Loaded Binance config from database', {
        wsUrl: this.exchangeConfig.wsUrl,
        maxReconnectDelay: this.exchangeConfig.maxReconnectDelay,
        maxConnectAttempts: this.exchangeConfig.maxConnectAttempts,
      });
    }
    return this.exchangeConfig;
  }

  setTradeCallback(callback: (trades: Trades[]) => void): void {
    this.tradeCallback = callback;
  }

  async connect(symbols: string[]): Promise<void> {
    if (symbols.length === 0)
      throw new Error('No symbols provided for connection');

    this.activeSymbols = [...symbols];

    // Get config from database (lazy loading)
    const config = await this.getExchangeConfig();
    const wsUrl = config.wsUrl;
    const rotationConfig = getRotationConfig();

    // Create WebSocketManager factory
    const wsManagerFactory: WebSocketManagerFactory = (url: string) => {
      return new WebSocketManager(
        url,
        5000,
        config.maxReconnectDelay,
        config.maxConnectAttempts
      );
    };

    // Create ConnectionRotator
    this.connectionRotator = new ConnectionRotator(
      wsUrl,
      wsManagerFactory,
      rotationConfig
    );

    // Set up trade message handler with deduplication
    this.connectionRotator.setOnTradeMessage(
      (data: any, connectionId: string) => {
        this.handleTradeMessage(data, connectionId);
      }
    );

    // Set up subscribe callback
    this.connectionRotator.setOnSubscribe(async (manager, syms) => {
      const streams = syms.map((s) => `${s.toLowerCase()}@trade`);
      await this.sendSubscribeCommandToManager(manager, streams);
    });

    // Start with symbols
    await this.connectionRotator.start(symbols);

    logger.info('BinanceWsTradeStreamAdapter connected', {
      symbols: symbols.length,
      rotationEnabled: rotationConfig.enabled,
    });
  }

  async disconnect(): Promise<void> {
    this.activeSymbols = [];
    this.tradeBuffer.clear();
    if (this.connectionRotator) {
      await this.connectionRotator.stop();
      this.connectionRotator = undefined;
    }
  }

  /**
   * Handle incoming trade message from WebSocket
   * Deduplication is handled by ProcessTradeUseCase in worker thread
   */
  private handleTradeMessage(rawData: any, _connectionId: string): void {
    try {
      const data = cloneDeep(rawData);

      // Basic validation - must have event type, symbol, and trade ID
      if (!data.e || !data.s || data.t === undefined) return;
      const symbol = data.s.toUpperCase();
      const tradeId = data.t;

      const trade: Trade = {
        e: data.e,
        E: data.E,
        T: data.T,
        s: symbol,
        t: tradeId,
        p: data.p || '0',
        q: data.q || '0',
        X: data.X,
        m: data.m,
      };

      this.bufferTrade(symbol, trade);
    } catch (error) {
      logger.error('Error in trade message handler', error);
    }
  }

  /**
   * Process trades and forward to callback
   * Gap detection is handled in worker thread by ProcessTradeUseCase
   */
  private async processTrades(symbol: string, trades: Trade[]): Promise<void> {
    if (trades.length === 0) return;

    // Send to callback (callback expects any[] which is compatible with Trade[])
    if (this.tradeCallback) {
      try {
        this.tradeCallback(trades as any);
      } catch (error) {
        logger.error(`Callback error for ${symbol}:`, error);
      }
    }
  }

  async subscribeSymbols(symbols: string[]): Promise<void> {
    if (symbols.length === 0) return;

    // If ConnectionRotator not initialized, connect first (handles standby mode)
    if (!this.connectionRotator) {
      logger.info(
        'ConnectionRotator not initialized, connecting for dynamic symbol subscription...'
      );
      await this.connect(symbols);
      return;
    }

    await this.connectionRotator.subscribeSymbols(symbols);
    this.activeSymbols.push(...symbols);
    logger.info(`Subscribed to additional ${symbols.length} symbols`);
  }

  async unsubscribeSymbols(symbols: string[]): Promise<void> {
    if (symbols.length === 0 || !this.connectionRotator) return;

    await this.connectionRotator.unsubscribeSymbols(symbols);
    this.activeSymbols = this.activeSymbols.filter(
      (s) => !symbols.includes(s.toUpperCase())
    );
    logger.info(`Unsubscribed from ${symbols.length} symbols`);
  }

  getStatus(): WebSocketConnectionStatus {
    if (!this.connectionRotator) {
      return {
        isConnected: false,
        connectionUrl: '',
        lastHeartbeat: Date.now(),
        reconnectCount: 0,
      };
    }

    const rotatorStatus = this.connectionRotator.getStatus();
    const primaryManager = this.connectionRotator.getPrimaryManager();

    return {
      isConnected: rotatorStatus.primaryConnection?.isConnected ?? false,
      connectionUrl: primaryManager
        ? primaryManager.getConnectionStatus().url
        : '',
      lastHeartbeat: Date.now(),
      reconnectCount: rotatorStatus.rotationCount,
    };
  }

  /**
   * Get extended status with rotation info
   */
  getExtendedStatus(): ExtendedWebSocketConnectionStatus {
    const baseStatus = this.getStatus();

    if (!this.connectionRotator) {
      return {
        ...baseStatus,
        rotationEnabled: false,
        isRotating: false,
        connectionAge: 0,
        nextRotationTime: null,
        rotationCount: 0,
        failedRotationCount: 0,
      };
    }

    const rotatorStatus = this.connectionRotator.getStatus();

    return {
      ...baseStatus,
      rotationEnabled: rotatorStatus.enabled,
      isRotating: rotatorStatus.isRotating,
      connectionAge: rotatorStatus.primaryConnection?.connectionAge ?? 0,
      nextRotationTime: rotatorStatus.nextRotationTime,
      rotationCount: rotatorStatus.rotationCount,
      failedRotationCount: rotatorStatus.failedRotationCount,
      secondaryConnectionStatus: rotatorStatus.secondaryConnection
        ? {
            isConnected: rotatorStatus.secondaryConnection.isConnected,
            connectionAge: rotatorStatus.secondaryConnection.connectionAge,
          }
        : undefined,
    };
  }

  isHealthy(): boolean {
    if (!this.connectionRotator) return false;
    const status = this.connectionRotator.getStatus();
    return (
      (status.primaryConnection?.isConnected ?? false) &&
      this.activeSymbols.length > 0
    );
  }

  /**
   * Subscribe to streams in batches to avoid "Payload too long" error
   * Binance WebSocket has ~4KB payload limit, so we batch 50 streams per message
   */
  private async sendSubscribeCommandToManager(
    manager: WebSocketManager,
    streams: string[]
  ): Promise<void> {
    const BATCH_SIZE = 50;
    const BATCH_DELAY_MS = 100;

    if (streams.length <= BATCH_SIZE) {
      const subscribeMessage = {
        method: 'SUBSCRIBE',
        params: streams,
        id: Date.now(),
      };
      await manager.send(subscribeMessage);
      logger.info(`Subscribed to ${streams.length} streams in single batch`);
      return;
    }

    // Split into batches
    const batches: string[][] = [];
    for (let i = 0; i < streams.length; i += BATCH_SIZE) {
      batches.push(streams.slice(i, i + BATCH_SIZE));
    }

    logger.info(
      `Subscribing to ${streams.length} streams in ${batches.length} batches (${BATCH_SIZE} per batch)`
    );

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const subscribeMessage = {
        method: 'SUBSCRIBE',
        params: batch,
        id: Date.now() + i,
      };
      await manager.send(subscribeMessage);
      logger.debug(
        `Sent subscribe batch ${i + 1}/${batches.length} (${
          batch.length
        } streams)`
      );

      if (i < batches.length - 1) {
        await this.sleep(BATCH_DELAY_MS);
      }
    }

    logger.info(`Successfully subscribed to all ${streams.length} streams`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private bufferTrade(symbol: string, trade: Trade): void {
    // Add to buffer
    const buffer = this.tradeBuffer.get(symbol) || [];
    buffer.push(trade);
    buffer.sort((a, b) => a.t! - b.t!);
    this.tradeBuffer.set(symbol, buffer);

    // Trigger processing only when this symbol is not being processed
    if (!this.processingSymbols.has(symbol)) {
      this.processBufferedTrades(symbol);
    }
  }

  private async processBufferedTrades(symbol: string): Promise<void> {
    if (this.processingSymbols.has(symbol)) return;

    this.processingSymbols.add(symbol);

    try {
      while (true) {
        const buffer = this.tradeBuffer.get(symbol);
        if (!buffer || buffer.length === 0) break;

        const tradesToProcess: Trade[] = [];
        while (buffer.length > 0) {
          const trade = buffer.shift()!;
          tradesToProcess.push(trade);
        }

        if (tradesToProcess.length > 0) {
          await this.processTrades(symbol, tradesToProcess);
        }
      }
    } finally {
      this.processingSymbols.delete(symbol);
    }
  }
}
