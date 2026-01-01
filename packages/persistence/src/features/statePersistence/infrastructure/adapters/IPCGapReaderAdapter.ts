/**
 * IPCGapReaderAdapter
 * Reads gap records via IPC from persistence worker.
 * This allows main process to read gaps without opening database directly.
 *
 * Uses length-prefixed binary protocol (same as IPCStatePersistenceAdapter):
 * - 4 bytes: message length (UInt32BE)
 * - N bytes: JSON message
 *
 * @module @flowtrace/persistence
 */

import * as net from 'net';
import { randomUUID } from 'crypto';
import type {
  GapReaderPort,
  GapRecord,
  GapLoadOptions,
  PaginatedGapsResult,
} from './ReadOnlyGapStorage.js';

/**
 * Configuration for IPCGapReaderAdapter
 */
export interface IPCGapReaderAdapterConfig {
  /** Path to Unix socket */
  socketPath: string;
  /** Request timeout in ms (default: 10000) */
  timeout?: number;
}

/**
 * IPCGapReaderAdapter
 * Implements GapReaderPort by sending requests to persistence worker via IPC.
 */
export class IPCGapReaderAdapter implements GapReaderPort {
  private readonly socketPath: string;
  private readonly timeout: number;

  constructor(config: IPCGapReaderAdapterConfig) {
    this.socketPath = config.socketPath;
    this.timeout = config.timeout ?? 10000;
  }

  /**
   * Load gaps with optional filtering and pagination
   */
  async loadGaps(options?: GapLoadOptions): Promise<PaginatedGapsResult> {
    const response = await this.sendRequest({
      id: randomUUID(),
      type: 'gap',
      payload: {
        action: 'gap_load',
        exchange: options?.exchange,
        symbol: options?.symbol,
        syncedOnly: options?.syncedOnly,
      },
      timestamp: Date.now(),
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to load gaps');
    }

    const gaps: GapRecord[] = (response.data?.gaps || []).map((g: any) => ({
      id: g.id,
      exchange: g.exchange,
      symbol: g.symbol,
      fromTradeId: g.fromTradeId,
      toTradeId: g.toTradeId,
      gapSize: g.gapSize,
      detectedAt: g.detectedAt,
      synced: g.synced,
      syncedAt: g.syncedAt,
    }));

    return {
      gaps,
      totalCount: gaps.length,
    };
  }

  /**
   * Count gaps by symbol
   */
  async countBySymbol(symbol: string): Promise<number> {
    const result = await this.loadGaps({ symbol });
    return result.totalCount;
  }

  /**
   * Get gap statistics by exchange
   */
  async getStatsByExchange(_exchange: string): Promise<{
    totalGaps: number;
    totalMissingTrades: number;
    symbolsAffected: number;
    oldestGap: number | null;
    newestGap: number | null;
  }> {
    const result = await this.loadGaps();
    const gaps = result.gaps;

    if (gaps.length === 0) {
      return {
        totalGaps: 0,
        totalMissingTrades: 0,
        symbolsAffected: 0,
        oldestGap: null,
        newestGap: null,
      };
    }

    const symbols = new Set(gaps.map((g) => g.symbol));
    const totalMissingTrades = gaps.reduce((sum, g) => sum + g.gapSize, 0);
    const detectedTimes = gaps.map((g) => g.detectedAt);

    return {
      totalGaps: gaps.length,
      totalMissingTrades,
      symbolsAffected: symbols.size,
      oldestGap: Math.min(...detectedTimes),
      newestGap: Math.max(...detectedTimes),
    };
  }

  /**
   * Close the reader (no-op for IPC adapter)
   */
  async close(): Promise<void> {
    // No persistent connection to close
  }

  /**
   * Serialize message with length prefix (same protocol as UnixSocketServer expects)
   */
  private serialize(message: unknown): Buffer {
    const json = JSON.stringify(message);
    const length = Buffer.byteLength(json);
    const header = Buffer.alloc(4);
    header.writeUInt32BE(length, 0);
    return Buffer.concat([header, Buffer.from(json)]);
  }

  /**
   * Send request to persistence worker via Unix socket
   * Uses length-prefixed binary protocol for both send and receive
   */
  private sendRequest(message: unknown): Promise<any> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(this.socketPath);
      let receiveBuffer = Buffer.alloc(0);

      const timeoutId = setTimeout(() => {
        console.error(
          '[IPCGapReaderAdapter] Request timeout, buffer length:',
          receiveBuffer.length
        );
        socket.destroy();
        reject(new Error(`Request timeout after ${this.timeout}ms`));
      }, this.timeout);

      socket.on('connect', () => {
        console.log('[IPCGapReaderAdapter] Connected, sending request');
        const buffer = this.serialize(message);
        socket.write(buffer);
      });

      socket.on('data', (data) => {
        receiveBuffer = Buffer.concat([receiveBuffer, data]);
        console.log(
          '[IPCGapReaderAdapter] Received data chunk, buffer length:',
          receiveBuffer.length
        );

        // Try to parse length-prefixed message
        if (receiveBuffer.length >= 4) {
          const messageLength = receiveBuffer.readUInt32BE(0);

          if (receiveBuffer.length >= 4 + messageLength) {
            const messageBuffer = receiveBuffer.subarray(4, 4 + messageLength);

            try {
              const response = JSON.parse(messageBuffer.toString());
              clearTimeout(timeoutId);
              console.log('[IPCGapReaderAdapter] Parsed response successfully');
              socket.end();
              resolve(response);
            } catch (e) {
              clearTimeout(timeoutId);
              socket.destroy();
              reject(new Error('Invalid JSON in response'));
            }
          }
        }
      });

      socket.on('end', () => {
        clearTimeout(timeoutId);
        console.log(
          '[IPCGapReaderAdapter] Socket ended, buffer length:',
          receiveBuffer.length
        );
        // If we haven't resolved yet, try to parse what we have
        if (receiveBuffer.length >= 4) {
          const messageLength = receiveBuffer.readUInt32BE(0);
          if (receiveBuffer.length >= 4 + messageLength) {
            try {
              const messageBuffer = receiveBuffer.subarray(
                4,
                4 + messageLength
              );
              resolve(JSON.parse(messageBuffer.toString()));
              return;
            } catch (e) {
              // Fall through to error
            }
          }
        }
        reject(new Error('No valid response received'));
      });

      socket.on('error', (err) => {
        clearTimeout(timeoutId);
        console.error('[IPCGapReaderAdapter] Socket error:', err.message);
        reject(err);
      });
    });
  }
}

/**
 * Factory function to create an IPC-based GapReader
 */
export function createIPCGapReader(
  config: IPCGapReaderAdapterConfig
): GapReaderPort {
  return new IPCGapReaderAdapter(config);
}
