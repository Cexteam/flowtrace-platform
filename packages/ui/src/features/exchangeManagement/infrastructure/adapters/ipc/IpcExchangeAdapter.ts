/**
 * IpcExchangeAdapter - IPC implementation of ExchangeApiPort
 *
 * Implements ExchangeApiPort for Desktop deployment using Electron IPC calls.
 *
 */

import { injectable } from 'inversify';
import type {
  ExchangeApiPort,
  GetExchangesRequest,
  GetExchangesResponse,
} from '../../../application/ports/out/ExchangeApiPort';
import type {
  Exchange,
  ExchangeHealthCheck,
  ExchangeToggleResult,
  ExchangeFeatures,
  ExchangeSyncHistoryEntry,
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
 * IPC adapter for exchange API operations
 *
 * Makes IPC calls to the Electron main process for exchange management.
 */
@injectable()
export class IpcExchangeAdapter implements ExchangeApiPort {
  /**
   * Get all exchanges with optional filtering
   */
  async getExchanges(
    request?: GetExchangesRequest
  ): Promise<GetExchangesResponse> {
    const api = getElectronAPI();
    const data = await api.invoke<{
      exchanges: Record<string, unknown>[];
      total: number;
    }>('exchanges:getAll', request);

    return {
      exchanges: data.exchanges.map(this.mapExchangeFromIpc),
      total: data.total,
    };
  }

  /**
   * Get health check status for a specific exchange
   */
  async getExchangeHealth(
    exchangeName: string
  ): Promise<ExchangeHealthCheck | null> {
    const api = getElectronAPI();
    const data = await api.invoke<Record<string, unknown> | null>(
      'exchanges:getHealth',
      { exchangeName }
    );

    if (!data) {
      return null;
    }

    return {
      status: data.status as ExchangeHealthCheck['status'],
      latencyMs: data.latencyMs as number,
      lastCheckedAt: new Date(data.lastCheckedAt as string | number),
      errorMessage: data.errorMessage as string | undefined,
    };
  }

  /**
   * Enable an exchange for data collection
   */
  async enableExchange(exchangeName: string): Promise<ExchangeToggleResult> {
    const api = getElectronAPI();
    return api.invoke<ExchangeToggleResult>('exchanges:enable', {
      exchangeName,
    });
  }

  /**
   * Disable an exchange from data collection
   */
  async disableExchange(exchangeName: string): Promise<ExchangeToggleResult> {
    const api = getElectronAPI();
    return api.invoke<ExchangeToggleResult>('exchanges:disable', {
      exchangeName,
    });
  }

  /**
   * Map IPC response to Exchange domain type
   */
  private mapExchangeFromIpc(data: Record<string, unknown>): Exchange {
    const features = data.features as Record<string, boolean> | undefined;
    const syncHistory = data.syncHistory as
      | Record<string, unknown>[]
      | undefined;

    return {
      name: data.name as string,
      displayName: data.displayName as string,
      implementationStatus:
        data.implementationStatus as Exchange['implementationStatus'],
      healthStatus: data.healthStatus as Exchange['healthStatus'],
      symbolCount: data.symbolCount as number,
      lastHealthCheck: data.lastHealthCheck
        ? new Date(data.lastHealthCheck as string | number)
        : null,
      isEnabled: data.isEnabled as boolean,
      features: {
        spotTrading: features?.spotTrading ?? false,
        futuresTrading: features?.futuresTrading ?? false,
        marginTrading: features?.marginTrading ?? false,
        websocketStreaming: features?.websocketStreaming ?? false,
        historicalData: features?.historicalData ?? false,
      } as ExchangeFeatures,
      apiStatus: data.apiStatus as Exchange['apiStatus'],
      syncHistory: (syncHistory || []).map(
        (entry): ExchangeSyncHistoryEntry => ({
          syncedAt: new Date(entry.syncedAt as string | number),
          symbolsAdded: entry.symbolsAdded as number,
          symbolsUpdated: entry.symbolsUpdated as number,
          symbolsDelisted: entry.symbolsDelisted as number,
          success: entry.success as boolean,
          errorMessage: entry.errorMessage as string | undefined,
        })
      ),
      createdAt: new Date(data.createdAt as string | number),
      updatedAt: new Date(data.updatedAt as string | number),
    };
  }
}
