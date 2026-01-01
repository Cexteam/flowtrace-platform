import { ipcMain } from 'electron';
import type {
  SymbolsService,
  SymbolsFilter,
  ValidExchange,
} from '@flowtrace/api';

const CHANNELS = [
  'symbols:getAll',
  'symbols:getById',
  'symbols:activate',
  'symbols:deactivate',
  'symbols:enableByAdmin',
  'symbols:disableByAdmin',
  'symbols:sync',
  'get-symbols',
  'get-symbol',
  'activate-symbol',
  'deactivate-symbol',
];

/**
 * Pagination request params for symbols
 */
interface SymbolsPaginationParams {
  exchange?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'all' | 'active' | 'inactive' | 'delisted' | 'pending_review';
  enabledByAdmin?: 'all' | 'enabled' | 'disabled';
  sortBy?: 'symbol' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Convert pagination params to SymbolsFilter
 */
function toSymbolsFilter(params?: SymbolsPaginationParams): SymbolsFilter {
  if (!params) return {};

  console.log('[IPC:toSymbolsFilter] Input params:', params);

  const filter: SymbolsFilter = {};

  if (params.exchange) {
    filter.exchange = params.exchange as ValidExchange;
  }

  if (params.page !== undefined) {
    filter.page = params.page;
  }

  if (params.pageSize !== undefined) {
    filter.pageSize = params.pageSize;
  }

  if (params.search) {
    filter.search = params.search;
  }

  if (params.status && params.status !== 'all') {
    filter.status = params.status as
      | 'active'
      | 'inactive'
      | 'delisted'
      | 'pending_review';
  }

  if (params.enabledByAdmin && params.enabledByAdmin !== 'all') {
    filter.enabledByAdmin = params.enabledByAdmin === 'enabled';
    console.log(
      '[IPC:toSymbolsFilter] enabledByAdmin filter:',
      filter.enabledByAdmin
    );
  }

  if (params.sortBy) {
    filter.sortBy = params.sortBy;
  }

  if (params.sortOrder) {
    filter.sortOrder = params.sortOrder;
  }

  console.log('[IPC:toSymbolsFilter] Output filter:', filter);
  return filter;
}

export function registerSymbolsIpcHandlers(s: SymbolsService): void {
  // Get all symbols with pagination support
  ipcMain.handle('symbols:getAll', (_, a?: SymbolsPaginationParams) =>
    s.getSymbols(toSymbolsFilter(a))
  );

  ipcMain.handle('symbols:getById', (_, a: { symbolId: string }) =>
    s.getSymbolById(a.symbolId)
  );

  ipcMain.handle('symbols:activate', (_, a: { symbolId: string }) =>
    s.activateSymbol(a.symbolId)
  );

  ipcMain.handle('symbols:deactivate', (_, a: { symbolId: string }) =>
    s.deactivateSymbol(a.symbolId)
  );

  // New handlers for admin enable/disable
  ipcMain.handle('symbols:enableByAdmin', (_, a: { symbolId: string }) =>
    s.enableByAdmin(a.symbolId)
  );

  ipcMain.handle('symbols:disableByAdmin', (_, a: { symbolId: string }) =>
    s.disableByAdmin(a.symbolId)
  );

  ipcMain.handle('symbols:sync', (_, a: { exchange: string }) =>
    s.syncSymbolsFromExchange(a.exchange as ValidExchange)
  );

  // Legacy handlers (backward compatibility)
  ipcMain.handle('get-symbols', (_, a?: SymbolsFilter) => s.getSymbols(a));
  ipcMain.handle('get-symbol', (_, a: { symbolId: string }) =>
    s.getSymbolById(a.symbolId)
  );
  ipcMain.handle('activate-symbol', (_, a: { symbolId: string }) =>
    s.activateSymbol(a.symbolId)
  );
  ipcMain.handle('deactivate-symbol', (_, a: { symbolId: string }) =>
    s.deactivateSymbol(a.symbolId)
  );
}

export function unregisterSymbolsIpcHandlers(): void {
  CHANNELS.forEach((c) => ipcMain.removeHandler(c));
}
