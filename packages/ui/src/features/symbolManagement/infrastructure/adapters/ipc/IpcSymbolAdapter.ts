/**
 * IpcSymbolAdapter - IPC implementation of SymbolApiPort
 *
 * Implements SymbolApiPort for Desktop deployment using Electron IPC calls.
 *
 */

import { injectable } from 'inversify';
import type {
  SymbolApiPort,
  GetSymbolsRequest,
  GetSymbolsResponse,
} from '../../../application/ports/out/SymbolApiPort';
import type {
  Symbol,
  SymbolConfig,
  ExchangeMetadata,
  SymbolToggleResult,
  SymbolSyncResult,
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
 * IPC adapter for symbol API operations
 *
 * Makes IPC calls to the Electron main process for symbol management.
 */
@injectable()
export class IpcSymbolAdapter implements SymbolApiPort {
  /**
   * Get symbols with optional filtering
   */
  async getSymbols(request?: GetSymbolsRequest): Promise<GetSymbolsResponse> {
    const api = getElectronAPI();
    const data = await api.invoke<{
      symbols: Record<string, unknown>[];
      total: number;
    }>('symbols:getAll', request);

    return {
      symbols: data.symbols.map(this.mapSymbolFromIpc),
      total: data.total,
    };
  }

  /**
   * Get a specific symbol by ID
   */
  async getSymbolById(symbolId: string): Promise<Symbol | null> {
    const api = getElectronAPI();
    const data = await api.invoke<Record<string, unknown> | null>(
      'symbols:getById',
      { symbolId }
    );

    if (!data) {
      return null;
    }

    return this.mapSymbolFromIpc(data);
  }

  /**
   * Activate a symbol for data collection
   */
  async activateSymbol(symbolId: string): Promise<SymbolToggleResult> {
    const api = getElectronAPI();
    return api.invoke<SymbolToggleResult>('symbols:activate', { symbolId });
  }

  /**
   * Deactivate a symbol from data collection
   */
  async deactivateSymbol(symbolId: string): Promise<SymbolToggleResult> {
    const api = getElectronAPI();
    return api.invoke<SymbolToggleResult>('symbols:deactivate', { symbolId });
  }

  /**
   * Trigger symbol sync for a specific exchange
   */
  async syncSymbols(exchange: string): Promise<SymbolSyncResult> {
    const api = getElectronAPI();
    const data = await api.invoke<Record<string, unknown>>('symbols:sync', {
      exchange,
    });

    return {
      success: data.success as boolean,
      exchange: data.exchange as string,
      symbolsAdded: data.symbolsAdded as number,
      symbolsUpdated: data.symbolsUpdated as number,
      symbolsDelisted: data.symbolsDelisted as number,
      syncedAt: new Date(data.syncedAt as string | number),
      message: data.message as string | undefined,
    };
  }

  /**
   * Map IPC response to Symbol domain type
   */
  private mapSymbolFromIpc(data: Record<string, unknown>): Symbol {
    const config = data.config as Record<string, unknown> | undefined;
    const exchangeMetadata = data.exchangeMetadata as Record<
      string,
      unknown
    > | null;

    return {
      id: data.id as string,
      symbol: data.symbol as string,
      exchange: data.exchange as string,
      baseAsset: data.baseAsset as string,
      quoteAsset: data.quoteAsset as string,
      status: data.status as Symbol['status'],
      enabledByAdmin: (data.enabledByAdmin as boolean) ?? true,
      isStreaming: data.isStreaming as boolean,
      isProcessing: data.isProcessing as boolean,
      config: {
        tickValue: (config?.tickValue as number) ?? 0,
        pricePrecision: (config?.pricePrecision as number) ?? 8,
        quantityPrecision: (config?.quantityPrecision as number) ?? 8,
      } as SymbolConfig,
      exchangeMetadata: exchangeMetadata as ExchangeMetadata | null,
      lastSyncAt: data.lastSyncAt
        ? new Date(data.lastSyncAt as string | number)
        : null,
      createdAt: new Date(data.createdAt as string | number),
      updatedAt: new Date(data.updatedAt as string | number),
    };
  }
}
