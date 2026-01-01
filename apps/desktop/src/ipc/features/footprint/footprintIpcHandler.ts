import { ipcMain } from 'electron';
import type {
  FootprintService,
  GetCompletedCandlesParams,
  GetCandleDetailParams,
} from '@flowtrace/api';

const CHANNELS = ['footprint:getCompleted', 'footprint:getCandleDetail'];

/**
 * Request params for getting completed candles
 */
interface CompletedCandlesRequest {
  exchange: string;
  symbol: string;
  timeframe: string;
  page?: number;
  pageSize?: number;
  startTime?: number;
  endTime?: number;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Request params for getting candle detail with footprint
 */
interface CandleDetailRequest {
  exchange: string;
  symbol: string;
  timeframe: string;
  openTime: number;
}

/**
 * Convert request to GetCompletedCandlesParams
 */
function toGetCompletedCandlesParams(
  req: CompletedCandlesRequest
): GetCompletedCandlesParams {
  return {
    exchange: req.exchange,
    symbol: req.symbol,
    timeframe: req.timeframe,
    page: req.page,
    pageSize: req.pageSize,
    startTime: req.startTime,
    endTime: req.endTime,
    sortOrder: req.sortOrder,
  };
}

/**
 * Convert request to GetCandleDetailParams
 */
function toGetCandleDetailParams(
  req: CandleDetailRequest
): GetCandleDetailParams {
  return {
    exchange: req.exchange,
    symbol: req.symbol,
    timeframe: req.timeframe,
    openTime: req.openTime,
  };
}

export function registerFootprintIpcHandlers(
  footprintService: FootprintService
): void {
  // Get completed candles with pagination and date range
  ipcMain.handle(
    'footprint:getCompleted',
    async (_, a: CompletedCandlesRequest) => {
      console.log('[IPC] footprint:getCompleted called with:', a);
      const params = toGetCompletedCandlesParams(a);
      console.log('[IPC] Converted params:', params);
      const result = await footprintService.getCompletedCandles(params);
      console.log('[IPC] Result:', {
        candlesCount: result.candles.length,
        pagination: result.pagination,
      });
      return result;
    }
  );

  // Get candle detail with footprint data
  ipcMain.handle(
    'footprint:getCandleDetail',
    async (_, a: CandleDetailRequest) => {
      console.log('[IPC] footprint:getCandleDetail called with:', a);
      const result = await footprintService.getCandleDetail(
        toGetCandleDetailParams(a)
      );
      console.log('[IPC] CandleDetail result:', result ? 'found' : 'null');
      return result;
    }
  );
}

export function unregisterFootprintIpcHandlers(): void {
  CHANNELS.forEach((c) => ipcMain.removeHandler(c));
}
