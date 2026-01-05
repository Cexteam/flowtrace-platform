/**
 * BinanceWebSocketAdapter
 *
 * Receives trades from Binance WebSocket and forwards them to workers.
 * Exchange config (URLs, reconnect settings) loaded from database via ExchangeRepository.
 *
 */

import { injectable, inject } from 'inversify';
import {
  Trade,
  Trades,
} from '../../../candleProcessing/domain/value-objects/TradeData.js';
import _ from 'lodash';
const { cloneDeep } = _;
import { TradeStreamPort } from '../../application/ports/out/TradeStreamPort.js';
import { WebSocketConnectionStatus } from '../../domain/types/index.js';
import { EXCHANGE_MANAGEMENT_SYMBOLS } from '../../../../shared/lib/di/bindings/features/exchangeManagement/types.js';
import { WebSocketManager } from '../services/index.js';
import { createLogger } from '../../../../shared/lib/logger/logger.js';
import type { ExchangeRepository } from '../../../exchangeManagement/domain/repositories/ExchangeRepository.js';
import type { Exchange } from '../../../exchangeManagement/domain/entities/Exchange.js';

const logger = createLogger('BinanceWsTradeStreamAdapter');

/**
 * BinanceWsTradeStreamAdapter
 *
 * Receives trades from Binance WebSocket and forwards them to workers.
 * Gap detection is now handled in worker thread by ProcessTradeUseCase.
 */
@injectable()
export class BinanceWsTradeStreamAdapter implements TradeStreamPort {
  private activeSymbols: string[] = [];
  private tradeCallback?: (trades: Trades[]) => void;
  private wsManager?: WebSocketManager;

  // Cached exchange config (lazy loaded)
  private exchangeConfig: Exchange | null = null;

  // Trade buffer for batching (kept for sequential processing)
  private tradeBuffer = new Map<string, Trade[]>();

  constructor(
    @inject(EXCHANGE_MANAGEMENT_SYMBOLS.ExchangeRepository)
    private exchangeRepository: ExchangeRepository
  ) {}

  /**
   * Get exchange config (lazy loading with cache)
   */
  private async getExchangeConfig(): Promise<Exchange> {
    if (!this.exchangeConfig) {
      this.exchangeConfig = await this.exchangeRepository.findById('binance');
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

    this.wsManager = new WebSocketManager(
      wsUrl,
      5000,
      config.maxReconnectDelay,
      config.maxConnectAttempts
    );

    this.wsManager.registerMessageHandler('stream', (data: any) => {
      this.handleTradeMessage(data);
    });

    // Register reconnect callback to re-subscribe active symbols
    this.wsManager.setOnReconnect(async () => {
      if (this.activeSymbols.length > 0) {
        logger.info(
          `Re-subscribing to ${this.activeSymbols.length} symbols after reconnect...`
        );
        const streams = this.activeSymbols.map(
          (s) => `${s.toLowerCase()}@trade`
        );
        await this.sendSubscribeCommand(streams);
        logger.info(
          `Successfully re-subscribed to ${this.activeSymbols.length} symbols`
        );
      }
    });

    await this.wsManager.connect();

    if (symbols.length > 0) {
      const streams = symbols.map((s) => `${s.toLowerCase()}@trade`);
      await this.sendSubscribeCommand(streams);
    }
  }

  async disconnect(): Promise<void> {
    this.activeSymbols = [];
    this.tradeBuffer.clear();
    if (this.wsManager) await this.wsManager.disconnect();
  }

  /**
   * Handle incoming trade message from WebSocket
   * Simply forwards trades to callback - gap detection is in worker thread
   */
  private handleTradeMessage(rawData: any): void {
    try {
      const data = cloneDeep(rawData);

      // Basic validation - must have event type, symbol, and trade ID
      if (!data.e || !data.s || data.t === undefined) return;
      const symbol = data.s.toUpperCase();

      const trade: Trade = {
        e: data.e,
        E: data.E,
        T: data.T,
        s: symbol,
        t: data.t,
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
   * Gap detection is now handled in worker thread by ProcessTradeUseCase
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

    // If WebSocket not connected yet, connect first (handles standby mode)
    if (!this.wsManager) {
      logger.info(
        'WebSocket not connected, connecting for dynamic symbol subscription...'
      );
      await this.connectForDynamicSubscription(symbols);
      return;
    }

    const streams = symbols.map((s) => `${s.toLowerCase()}@trade`);
    await this.sendSubscribeCommand(streams);
    this.activeSymbols.push(...symbols);
    logger.info(`Subscribed to additional ${symbols.length} symbols`);
  }

  /**
   * Connect WebSocket for dynamic symbol subscription
   * Used when service started in standby mode (no initial symbols)
   */
  private async connectForDynamicSubscription(
    symbols: string[]
  ): Promise<void> {
    // Get config from database (lazy loading)
    const config = await this.getExchangeConfig();
    const wsUrl = config.wsUrl;

    this.wsManager = new WebSocketManager(
      wsUrl,
      5000,
      config.maxReconnectDelay,
      config.maxConnectAttempts
    );

    this.wsManager.registerMessageHandler('stream', (data: any) => {
      this.handleTradeMessage(data);
    });

    // Register reconnect callback to re-subscribe active symbols
    this.wsManager.setOnReconnect(async () => {
      if (this.activeSymbols.length > 0) {
        logger.info(
          `Re-subscribing to ${this.activeSymbols.length} symbols after reconnect...`
        );
        const streams = this.activeSymbols.map(
          (s) => `${s.toLowerCase()}@trade`
        );
        await this.sendSubscribeCommand(streams);
        logger.info(
          `Successfully re-subscribed to ${this.activeSymbols.length} symbols`
        );
      }
    });

    await this.wsManager.connect();

    // Subscribe to the requested symbols
    const streams = symbols.map((s) => `${s.toLowerCase()}@trade`);
    await this.sendSubscribeCommand(streams);
    this.activeSymbols.push(...symbols);

    logger.info(
      `WebSocket connected and subscribed to ${symbols.length} symbols (dynamic subscription)`
    );
  }

  async unsubscribeSymbols(symbols: string[]): Promise<void> {
    if (symbols.length === 0 || !this.wsManager) return;
    const streams = symbols.map((s) => `${s.toLowerCase()}@trade`);
    await this.sendUnsubscribeCommand(streams);
    this.activeSymbols = this.activeSymbols.filter(
      (s) => !symbols.includes(s.toUpperCase())
    );
    logger.info(`Unsubscribed from ${symbols.length} symbols`);
  }

  getStatus(): WebSocketConnectionStatus {
    if (!this.wsManager) {
      return {
        isConnected: false,
        connectionUrl: '',
        lastHeartbeat: Date.now(),
        reconnectCount: 0,
      };
    }
    const connStatus = this.wsManager.getConnectionStatus();
    return {
      isConnected: connStatus.isConnected,
      connectionUrl: connStatus.url,
      lastHeartbeat: Date.now(),
      reconnectCount: connStatus.reconnectAttempts,
    };
  }

  isHealthy(): boolean {
    if (!this.wsManager) return false;
    const status = this.wsManager.getConnectionStatus();
    return status.isConnected && this.activeSymbols.length > 0;
  }

  /**
   * Subscribe to streams in batches to avoid "Payload too long" error
   * Binance WebSocket has ~4KB payload limit, so we batch 50 streams per message
   */
  private async sendSubscribeCommand(streams: string[]): Promise<void> {
    const BATCH_SIZE = 50; // Safe batch size to stay under 4KB payload limit
    const BATCH_DELAY_MS = 100; // Small delay between batches to avoid rate limiting

    if (streams.length <= BATCH_SIZE) {
      // Small enough to send in one message
      const subscribeMessage = {
        method: 'SUBSCRIBE',
        params: streams,
        id: Date.now(),
      };
      await this.wsManager!.send(subscribeMessage);
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
        id: Date.now() + i, // Unique ID for each batch
      };
      await this.wsManager!.send(subscribeMessage);
      logger.debug(
        `Sent subscribe batch ${i + 1}/${batches.length} (${
          batch.length
        } streams)`
      );

      // Add delay between batches (except for last batch)
      if (i < batches.length - 1) {
        await this.sleep(BATCH_DELAY_MS);
      }
    }

    logger.info(`Successfully subscribed to all ${streams.length} streams`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async sendUnsubscribeCommand(streams: string[]): Promise<void> {
    const unsubscribeMessage = {
      method: 'UNSUBSCRIBE',
      params: streams,
      id: Date.now(),
    };
    await this.wsManager!.send(unsubscribeMessage);
  }

  // Trade buffer for batching - kept for sequential processing
  // Use per-symbol processing flags to avoid blocking other symbols
  private processingSymbols = new Set<string>();

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
    // Check if this symbol is already being processed
    if (this.processingSymbols.has(symbol)) return;

    this.processingSymbols.add(symbol);

    try {
      // Keep processing until buffer is empty
      // This handles trades that arrive while we're processing
      while (true) {
        const buffer = this.tradeBuffer.get(symbol);
        if (!buffer || buffer.length === 0) break;

        // Process all buffered trades - send ALL trades to worker for gap detection
        // MARKET filtering happens in FootprintCandle.applyTrade()
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
