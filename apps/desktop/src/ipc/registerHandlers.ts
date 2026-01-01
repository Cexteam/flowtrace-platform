import { ipcMain, BrowserWindow, app } from 'electron';
import type { INestApplicationContext } from '@nestjs/common';
import {
  SymbolsService,
  ExchangesService,
  WorkersService,
  DataQualityService,
  FootprintService,
  BRIDGE_TOKENS,
} from '@flowtrace/api';
import { createLogger, type ICache } from '@flowtrace/core';
import {
  registerSymbolsIpcHandlers,
  unregisterSymbolsIpcHandlers,
} from './features/symbols/index.js';
import {
  registerExchangesIpcHandlers,
  unregisterExchangesIpcHandlers,
} from './features/exchanges/index.js';
import {
  registerWorkersIpcHandlers,
  unregisterWorkersIpcHandlers,
} from './features/workers/index.js';
import {
  registerDataQualityIpcHandlers,
  unregisterDataQualityIpcHandlers,
} from './features/dataQuality/index.js';
import {
  registerFootprintIpcHandlers,
  unregisterFootprintIpcHandlers,
} from './features/footprint/index.js';

const logger = createLogger('IPC'),
  subs = new Map<string, () => void>();
const APP_CH = [
  'get-app-info',
  'get-data-path',
  'subscribe-candles',
  'unsubscribe-candles',
  'get-candles',
  'get-footprint',
];

export function registerIpcHandlers(nest: INestApplicationContext): void {
  logger.info('Registering IPC handlers...');
  registerSymbolsIpcHandlers(nest.get(SymbolsService));
  registerExchangesIpcHandlers(nest.get(ExchangesService));
  registerWorkersIpcHandlers(nest.get(WorkersService));
  registerDataQualityIpcHandlers(nest.get(DataQualityService));
  registerFootprintIpcHandlers(nest.get(FootprintService));
  ipcMain.handle('get-app-info', () => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    nodeVersion: process.version,
  }));
  ipcMain.handle('get-data-path', () => ({
    userData: app.getPath('userData'),
    documents: app.getPath('documents'),
    temp: app.getPath('temp'),
  }));
  ipcMain.handle(
    'subscribe-candles',
    async (_, { symbol }: { symbol: string }) => {
      try {
        const cache = nest.get<ICache>(BRIDGE_TOKENS.CACHE),
          ch = `candle:${symbol}`;
        if (subs.has(ch))
          return { success: true, message: 'Already subscribed' };
        subs.set(
          ch,
          await cache.subscribe(ch, (m) =>
            BrowserWindow.getAllWindows().forEach((w) =>
              w.webContents.send(ch, m)
            )
          )
        );
        return { success: true };
      } catch {
        return { success: false, error: 'Cache not available' };
      }
    }
  );
  ipcMain.handle('unsubscribe-candles', (_, { symbol }: { symbol: string }) => {
    const ch = `candle:${symbol}`;
    subs.get(ch)?.();
    subs.delete(ch);
    return { success: true };
  });
  ipcMain.handle('get-candles', () => []);
  ipcMain.handle('get-footprint', () => null);
  logger.info('IPC handlers registered');
}

export function unregisterIpcHandlers(): void {
  logger.info('Unregistering...');
  unregisterSymbolsIpcHandlers();
  unregisterExchangesIpcHandlers();
  unregisterWorkersIpcHandlers();
  unregisterDataQualityIpcHandlers();
  unregisterFootprintIpcHandlers();
  subs.forEach((u) => u());
  subs.clear();
  APP_CH.forEach((c) => ipcMain.removeHandler(c));
  logger.info('Done');
}
