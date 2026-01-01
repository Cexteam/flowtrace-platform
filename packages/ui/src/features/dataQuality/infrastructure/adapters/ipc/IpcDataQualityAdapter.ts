/**
 * IpcDataQualityAdapter - IPC implementation of DataQualityApiPort
 *
 * Implements DataQualityApiPort for Desktop deployment using Electron IPC calls.
 *
 */

import { injectable } from 'inversify';
import type { DataQualityApiPort } from '../../../application/ports/out/DataQualityApiPort';
import type {
  CheckTradeGapsRequest,
  CheckTradeGapsResponse,
  TradeGap,
} from '../../../domain/types';

/**
 * Electron IPC API interface
 */
interface ElectronAPI {
  invoke: <T>(channel: string, data?: unknown) => Promise<T>;
}

/**
 * Get the Electron API from window
 * Note: preload.ts exposes API as 'electron', not 'electronAPI'
 */
function getElectronAPI(): ElectronAPI {
  if (typeof window === 'undefined' || !('electron' in window)) {
    throw new Error(
      'Electron IPC not available - not running in Electron environment'
    );
  }
  return (window as unknown as { electron: ElectronAPI }).electron;
}

/**
 * IPC adapter for data quality API operations
 *
 * Makes IPC calls to the Electron main process for data quality checks.
 */
@injectable()
export class IpcDataQualityAdapter implements DataQualityApiPort {
  /**
   * Check for trade data gaps via IPC
   */
  async checkTradeGaps(
    request: CheckTradeGapsRequest
  ): Promise<CheckTradeGapsResponse> {
    const api = getElectronAPI();
    const data = await api.invoke<Record<string, unknown>>(
      'dataQuality:checkGaps',
      request
    );

    return this.mapResponseFromIpc(data, request);
  }

  /**
   * Map IPC response to CheckTradeGapsResponse domain type
   */
  private mapResponseFromIpc(
    data: Record<string, unknown>,
    request: CheckTradeGapsRequest
  ): CheckTradeGapsResponse {
    const gaps = ((data.gaps as Array<Record<string, unknown>>) || []).map(
      (gap): TradeGap => ({
        from: gap.from as number,
        to: gap.to as number,
        duration: gap.duration as number,
      })
    );

    const totalMissingDuration = gaps.reduce(
      (sum, gap) => sum + gap.duration,
      0
    );
    const totalTimeRange = request.toTime - request.fromTime;
    const dataCompleteness =
      totalTimeRange > 0
        ? Math.max(
            0,
            Math.min(
              100,
              ((totalTimeRange - totalMissingDuration) / totalTimeRange) * 100
            )
          )
        : 100;

    return {
      gaps,
      totalGaps: (data.totalGaps as number) ?? gaps.length,
      totalMissingDuration:
        (data.totalMissingDuration as number) ?? totalMissingDuration,
      dataCompleteness: (data.dataCompleteness as number) ?? dataCompleteness,
      symbol: request.symbol,
      exchange: request.exchange,
      fromTime: request.fromTime,
      toTime: request.toTime,
      checkedAt: new Date((data.checkedAt as string | number) || Date.now()),
    };
  }
}
