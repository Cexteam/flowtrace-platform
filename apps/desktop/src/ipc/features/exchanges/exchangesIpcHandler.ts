import { ipcMain } from 'electron';
import type { ExchangesService, ExchangesFilter } from '@flowtrace/api';

const CHANNELS = [
  'exchanges:getAll',
  'exchanges:getById',
  'exchanges:getHealth',
  'exchanges:enable',
  'exchanges:disable',
];

/**
 * Pagination request params for exchanges
 */
interface ExchangesPaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'all' | 'enabled' | 'disabled';
  sortBy?: 'name' | 'enabled' | 'healthStatus';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Convert pagination params to ExchangesFilter
 */
function toExchangesFilter(
  params?: ExchangesPaginationParams
): ExchangesFilter {
  if (!params) return {};

  const filter: ExchangesFilter = {};

  // Only set page if it's a positive number (1-based indexing)
  if (params.page !== undefined && params.page > 0) {
    filter.page = params.page;
  }

  if (params.pageSize !== undefined) {
    filter.pageSize = params.pageSize;
  }

  if (params.search) {
    filter.search = params.search;
  }

  if (params.status && params.status !== 'all') {
    filter.enabled = params.status === 'enabled';
  }

  if (params.sortBy) {
    filter.sortBy = params.sortBy;
  }

  if (params.sortOrder) {
    filter.sortOrder = params.sortOrder;
  }

  return filter;
}

export function registerExchangesIpcHandlers(s: ExchangesService): void {
  // Get all exchanges with pagination support
  ipcMain.handle(
    'exchanges:getAll',
    async (_, a?: ExchangesPaginationParams) => {
      const result = await s.getExchanges(toExchangesFilter(a));
      console.log(
        '[IPC:exchanges:getAll] Result:',
        JSON.stringify(result, null, 2)
      );
      return result;
    }
  );

  ipcMain.handle('exchanges:getById', (_, a: { exchangeId: string }) =>
    s.getExchangeById(a.exchangeId)
  );

  ipcMain.handle(
    'exchanges:getHealth',
    (_, a: { exchangeId?: string; exchangeName?: string }) => {
      const id = a.exchangeId || a.exchangeName;
      if (!id) throw new Error('exchangeId or exchangeName is required');
      return s.getExchangeHealth(id);
    }
  );

  ipcMain.handle(
    'exchanges:enable',
    async (_, a: { exchangeId?: string; exchangeName?: string }) => {
      const id = a.exchangeId || a.exchangeName;
      if (!id) throw new Error('exchangeId or exchangeName is required');
      console.log('[IPC:exchanges:enable] Enabling exchange:', id);
      const result = await s.enableExchange(id);
      console.log('[IPC:exchanges:enable] Result:', result);
      return result;
    }
  );

  ipcMain.handle(
    'exchanges:disable',
    async (_, a: { exchangeId?: string; exchangeName?: string }) => {
      const id = a.exchangeId || a.exchangeName;
      if (!id) throw new Error('exchangeId or exchangeName is required');
      console.log('[IPC:exchanges:disable] Disabling exchange:', id);
      const result = await s.disableExchange(id);
      console.log('[IPC:exchanges:disable] Result:', result);
      return result;
    }
  );
}

export function unregisterExchangesIpcHandlers(): void {
  CHANNELS.forEach((c) => ipcMain.removeHandler(c));
}
