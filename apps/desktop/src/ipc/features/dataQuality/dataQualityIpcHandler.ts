import { ipcMain } from 'electron';
import type {
  DataQualityService,
  GapCheckParams,
  GetGapsByExchangeParams,
} from '@flowtrace/api';

const CHANNELS = ['dataQuality:checkGaps', 'dataQuality:getGapsByExchange'];

/**
 * Pagination request params for gaps by exchange
 */
interface GapsByExchangePaginationParams {
  exchange: string;
  page?: number;
  pageSize?: number;
  search?: string;
  severity?: 'all' | 'critical' | 'warning' | 'info';
  sortBy?: 'gapCount' | 'totalMissingTrades' | 'lastGapTime' | 'symbol';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Convert pagination params to GetGapsByExchangeParams
 */
function toGetGapsByExchangeParams(
  params: GapsByExchangePaginationParams
): GetGapsByExchangeParams {
  return {
    exchange: params.exchange,
    page: params.page,
    pageSize: params.pageSize,
    search: params.search,
    severity: params.severity,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  };
}

export function registerDataQualityIpcHandlers(s: DataQualityService): void {
  // Check gaps in time range
  ipcMain.handle('dataQuality:checkGaps', (_, a: GapCheckParams) =>
    s.checkGaps(a)
  );

  // Get gaps by exchange with pagination
  ipcMain.handle(
    'dataQuality:getGapsByExchange',
    (_, a: GapsByExchangePaginationParams) =>
      s.getGapsByExchange(toGetGapsByExchangeParams(a))
  );
}

export function unregisterDataQualityIpcHandlers(): void {
  CHANNELS.forEach((c) => ipcMain.removeHandler(c));
}
