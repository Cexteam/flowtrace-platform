/**
 * Unix Socket Client for IPC
 *
 * Provides high-performance local IPC using Unix domain sockets.
 * This is the primary communication channel for real-time message delivery.
 */

import * as net from 'net';
import type { UnixSocketClientConfig } from './types.js';

export class UnixSocketClient {
  private socket: net.Socket | null = null;
  private connected: boolean = false;
  private readonly socketPath: string;
  private readonly connectTimeout: number;

  constructor(config: UnixSocketClientConfig) {
    this.socketPath = config.socketPath;
    this.connectTimeout = config.connectTimeout ?? 5000;
  }

  /**
   * Connect to the Unix socket server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error(`Connection timeout after ${this.connectTimeout}ms`));
      }, this.connectTimeout);

      this.socket = net.createConnection(this.socketPath);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.connected = true;
        resolve();
      });

      this.socket.on('error', (error) => {
        clearTimeout(timeout);
        this.connected = false;
        reject(error);
      });

      this.socket.on('close', () => {
        this.connected = false;
      });
    });
  }

  /**
   * Send a message through the Unix socket
   *
   * Messages are serialized with a length-prefix protocol:
   * [4 bytes: message length][N bytes: JSON message]
   */
  async send(message: unknown): Promise<void> {
    if (!this.connected || !this.socket) {
      throw new Error('Not connected to Unix socket');
    }

    const buffer = this.serialize(message);

    return new Promise((resolve, reject) => {
      this.socket!.write(buffer, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Check if the client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Disconnect from the Unix socket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.end();
      this.socket = null;
      this.connected = false;
    }
  }

  /**
   * Serialize message with length prefix
   */
  private serialize(message: unknown): Buffer {
    const json = JSON.stringify(message);
    const length = Buffer.byteLength(json);
    const header = Buffer.alloc(4);
    header.writeUInt32BE(length, 0);
    return Buffer.concat([header, Buffer.from(json)]);
  }
}
