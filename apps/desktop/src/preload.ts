/**
 * FlowTrace Desktop - Preload Script
 *
 * Exposes a safe API to the renderer process via contextBridge.
 * This script runs in a privileged context and bridges the main process
 * with the renderer process.
 *
 * Validates: Requirements 3.1, 3.2 (Desktop App Bootstrap Flow)
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * Electron API exposed to the renderer process
 */
const electronAPI = {
  /**
   * Invoke an IPC handler in the main process
   * @param channel - The IPC channel name
   * @param args - Arguments to pass to the handler
   * @returns Promise resolving to the handler's return value
   */
  invoke: <T>(channel: string, args: unknown): Promise<T> => {
    // Whitelist of allowed channels organized by feature
    const validChannels = [
      // Worker Management
      'workers:getAll',
      'workers:getById',
      'workers:spawn',
      'workers:getHealth',
      'workers:getStats',

      // Exchange Management
      'exchanges:getAll',
      'exchanges:getById',
      'exchanges:getHealth',
      'exchanges:enable',
      'exchanges:disable',

      // Symbol Management
      'symbols:getAll',
      'symbols:getById',
      'symbols:activate',
      'symbols:deactivate',
      'symbols:enableByAdmin',
      'symbols:disableByAdmin',
      'symbols:sync',

      // Data Quality
      'dataQuality:checkGaps',
      'dataQuality:getGapsByExchange',

      // Candles & Footprint
      'candles:getCompleted',
      'footprint:getCompleted',
      'footprint:getCandleDetail',
      'get-candles',
      'get-footprint',

      // Subscriptions
      'subscribe-candles',
      'unsubscribe-candles',

      // App Info
      'get-app-info',
      'get-data-path',

      // Legacy handlers (backward compatibility)
      'get-symbols',
      'get-symbol',
      'activate-symbol',
      'deactivate-symbol',
      'get-workers',
      'get-worker-stats',
    ];

    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, args);
    }

    return Promise.reject(new Error(`Invalid IPC channel: ${channel}`));
  },

  /**
   * Listen for events from the main process
   * @param channel - The IPC channel name
   * @param callback - Callback function to handle the event
   * @returns Unsubscribe function
   */
  on: (channel: string, callback: (data: unknown) => void): (() => void) => {
    // Whitelist of allowed channels for listening
    const validChannels = [
      'candle:*', // Pattern for candle updates
      'worker:status', // Worker state changes
      'worker:health', // Worker health updates
      'symbol:status', // Symbol state changes
      'exchange:status', // Exchange state changes
      'app:error',
      'app:notification',
    ];

    // Check if channel matches any valid pattern
    const isValid = validChannels.some((pattern) => {
      if (pattern.includes('*')) {
        const prefix = pattern.replace('*', '');
        return channel.startsWith(prefix);
      }
      return channel === pattern;
    });

    if (!isValid) {
      console.warn(`Invalid IPC channel for listening: ${channel}`);
      return () => {};
    }

    const listener = (_event: Electron.IpcRendererEvent, data: unknown) => {
      callback(data);
    };

    ipcRenderer.on(channel, listener);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },

  /**
   * Send a one-way message to the main process
   * @param channel - The IPC channel name
   * @param args - Arguments to pass
   */
  send: (channel: string, args: unknown): void => {
    const validChannels = ['log', 'analytics'];

    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, args);
    }
  },

  /**
   * Platform information
   */
  platform: process.platform,

  /**
   * App version
   */
  version: process.env['npm_package_version'] || '1.0.0',
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electron', electronAPI);

// Type declaration for the exposed API
declare global {
  interface Window {
    electron: typeof electronAPI;
  }
}
