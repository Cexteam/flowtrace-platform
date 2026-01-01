/**
 * SymbolController - API Functions for Symbol Management
 *
 * API functions that make HTTP requests (web) or IPC calls (Electron).
 * Automatically detects environment and uses appropriate adapter.
 * Follows the Controller → Hook → Component pattern.
 *
 */

import type {
  Symbol,
  SymbolStatus,
  SymbolToggleResult,
  SymbolSyncResult,
} from '../../domain/types';
import type {
  GetSymbolsRequest,
  GetSymbolsResponse,
} from '../../application/ports/out/SymbolApiPort';

/**
 * Server Action result type
 */
export interface ServerActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Check if running in Electron environment
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && 'electron' in window;
}

/**
 * Get Electron API (type-safe)
 */
function getElectronAPI(): {
  invoke: <T>(channel: string, args?: unknown) => Promise<T>;
} | null {
  if (isElectron()) {
    return (
      window as unknown as {
        electron: {
          invoke: <T>(channel: string, args?: unknown) => Promise<T>;
        };
      }
    ).electron;
  }
  return null;
}

/**
 * Get symbols list with optional filtering
 *
 * @param request - Optional filter parameters
 * @returns Server action result with symbols data
 */
export async function getSymbolsAction(
  request?: GetSymbolsRequest
): Promise<ServerActionResult<GetSymbolsResponse>> {
  try {
    const electronAPI = getElectronAPI();

    if (electronAPI) {
      // Electron: Use IPC
      console.log(
        '[SymbolController] Calling symbols:getAll with request:',
        request
      );
      const data = await electronAPI.invoke<{
        symbols: Record<string, unknown>[];
        total?: number;
        pagination?: {
          page: number;
          pageSize: number;
          totalCount: number;
          totalPages: number;
        };
      }>('symbols:getAll', request);
      console.log('[SymbolController] symbols:getAll raw response:', data);
      console.log('[SymbolController] symbols count:', data.symbols?.length);
      console.log('[SymbolController] total:', data.total);
      console.log('[SymbolController] pagination:', data.pagination);

      // Handle both legacy (total) and new pagination format
      const total = data.pagination?.totalCount ?? data.total ?? 0;

      // Log first symbol to debug mapping
      if (data.symbols?.length > 0) {
        console.log(
          '[SymbolController] First symbol raw data:',
          data.symbols[0]
        );
      }

      const mappedSymbols = data.symbols.map(mapSymbolFromApi);
      if (mappedSymbols.length > 0) {
        console.log(
          '[SymbolController] First symbol mapped:',
          mappedSymbols[0]
        );
      }

      return {
        success: true,
        data: {
          symbols: mappedSymbols,
          total,
        },
      };
    }

    // Web: Use HTTP API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    const params = new URLSearchParams();
    if (request?.exchange) params.append('exchange', request.exchange);
    if (request?.status) params.append('status', request.status);
    if (request?.isStreaming !== undefined)
      params.append('isStreaming', request.isStreaming.toString());
    if (request?.isProcessing !== undefined)
      params.append('isProcessing', request.isProcessing.toString());
    if (request?.limit) params.append('limit', request.limit.toString());
    if (request?.offset) params.append('offset', request.offset.toString());

    const queryString = params.toString();
    const url = `${apiUrl}/symbols${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch symbols: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: {
        symbols: data.symbols.map(mapSymbolFromApi),
        total: data.total,
      },
    };
  } catch (err) {
    console.error('[SymbolController] getSymbolsAction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get symbol by ID
 */
export async function getSymbolByIdAction(
  symbolId: string
): Promise<ServerActionResult<Symbol>> {
  try {
    const electronAPI = getElectronAPI();

    if (electronAPI) {
      const data = await electronAPI.invoke<Record<string, unknown> | null>(
        'symbols:getById',
        { symbolId }
      );
      if (!data) {
        return { success: false, error: 'Symbol not found' };
      }
      return { success: true, data: mapSymbolFromApi(data) };
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/symbols/${symbolId}`, {
      cache: 'no-store',
    });

    if (response.status === 404) {
      return { success: false, error: 'Symbol not found' };
    }

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch symbol: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return { success: true, data: mapSymbolFromApi(data) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Activate a symbol
 */
export async function activateSymbolAction(
  symbolId: string
): Promise<ServerActionResult<SymbolToggleResult>> {
  try {
    console.log(
      '[SymbolController] activateSymbolAction called with:',
      symbolId
    );
    const electronAPI = getElectronAPI();

    if (electronAPI) {
      console.log('[SymbolController] Calling symbols:activate via IPC');
      const data = await electronAPI.invoke<{
        success: boolean;
        message?: string;
      }>('symbols:activate', { symbolId });
      console.log('[SymbolController] symbols:activate response:', data);
      return {
        success: data.success,
        data: {
          success: data.success,
          symbolId,
          status: 'active' as SymbolStatus,
          message: data.message,
        },
        error: data.success ? undefined : data.message,
      };
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/symbols/${symbolId}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error:
          data.message || `Failed to activate symbol: ${response.statusText}`,
      };
    }

    return {
      success: true,
      data: {
        success: true,
        symbolId,
        status: 'active' as SymbolStatus,
        message: data.message,
      },
    };
  } catch (err) {
    console.error('[SymbolController] activateSymbolAction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Deactivate a symbol
 */
export async function deactivateSymbolAction(
  symbolId: string
): Promise<ServerActionResult<SymbolToggleResult>> {
  try {
    const electronAPI = getElectronAPI();

    if (electronAPI) {
      const data = await electronAPI.invoke<{
        success: boolean;
        message?: string;
      }>('symbols:deactivate', { symbolId });
      return {
        success: data.success,
        data: {
          success: data.success,
          symbolId,
          status: 'inactive' as SymbolStatus,
          message: data.message,
        },
        error: data.success ? undefined : data.message,
      };
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/symbols/${symbolId}/deactivate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error:
          data.message || `Failed to deactivate symbol: ${response.statusText}`,
      };
    }

    return {
      success: true,
      data: {
        success: true,
        symbolId,
        status: 'inactive' as SymbolStatus,
        message: data.message,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Sync symbols for an exchange
 */
export async function syncSymbolsAction(
  exchange: string
): Promise<ServerActionResult<SymbolSyncResult>> {
  try {
    const electronAPI = getElectronAPI();

    if (electronAPI) {
      const data = await electronAPI.invoke<{
        success: boolean;
        symbolsAdded?: number;
        symbolsUpdated?: number;
        symbolsDelisted?: number;
        syncedAt?: string;
        message?: string;
      }>('symbols:sync', { exchange });
      return {
        success: data.success,
        data: {
          success: data.success,
          exchange,
          symbolsAdded: data.symbolsAdded ?? 0,
          symbolsUpdated: data.symbolsUpdated ?? 0,
          symbolsDelisted: data.symbolsDelisted ?? 0,
          syncedAt: data.syncedAt ? new Date(data.syncedAt) : new Date(),
          message: data.message,
        },
        error: data.success ? undefined : data.message,
      };
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/symbols/sync/${exchange}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || `Failed to sync symbols: ${response.statusText}`,
      };
    }

    return {
      success: true,
      data: {
        success: true,
        exchange,
        symbolsAdded: data.symbolsAdded,
        symbolsUpdated: data.symbolsUpdated,
        symbolsDelisted: data.symbolsDelisted,
        syncedAt: new Date(data.syncedAt),
        message: data.message,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Admin enabled toggle result
 */
export interface AdminEnabledToggleResult {
  success: boolean;
  symbolId: string;
  enabledByAdmin: boolean;
  message?: string;
}

/**
 * Enable a symbol by admin
 */
export async function enableByAdminAction(
  symbolId: string
): Promise<ServerActionResult<AdminEnabledToggleResult>> {
  try {
    const electronAPI = getElectronAPI();

    if (electronAPI) {
      const data = await electronAPI.invoke<{
        success: boolean;
        message?: string;
      }>('symbols:enableByAdmin', { symbolId });
      return {
        success: data.success,
        data: {
          success: data.success,
          symbolId,
          enabledByAdmin: true,
          message: data.message,
        },
        error: data.success ? undefined : data.message,
      };
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/symbols/${symbolId}/enable-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error:
          data.message ||
          `Failed to enable symbol by admin: ${response.statusText}`,
      };
    }

    return {
      success: true,
      data: {
        success: true,
        symbolId,
        enabledByAdmin: true,
        message: data.message,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Disable a symbol by admin
 */
export async function disableByAdminAction(
  symbolId: string
): Promise<ServerActionResult<AdminEnabledToggleResult>> {
  try {
    const electronAPI = getElectronAPI();

    if (electronAPI) {
      const data = await electronAPI.invoke<{
        success: boolean;
        message?: string;
      }>('symbols:disableByAdmin', { symbolId });
      return {
        success: data.success,
        data: {
          success: data.success,
          symbolId,
          enabledByAdmin: false,
          message: data.message,
        },
        error: data.success ? undefined : data.message,
      };
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(
      `${apiUrl}/symbols/${symbolId}/disable-admin`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error:
          data.message ||
          `Failed to disable symbol by admin: ${response.statusText}`,
      };
    }

    return {
      success: true,
      data: {
        success: true,
        symbolId,
        enabledByAdmin: false,
        message: data.message,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Map API response to Symbol domain type
 */
function mapSymbolFromApi(data: Record<string, unknown>): Symbol {
  const config = data.config as Record<string, unknown> | undefined;
  const exchangeMetadata = data.exchangeMetadata as Record<
    string,
    unknown
  > | null;

  // API returns 'enabled' not 'enabledByAdmin'
  const enabledByAdmin =
    data.enabled !== undefined
      ? (data.enabled as boolean)
      : (data.enabledByAdmin as boolean) ?? false;

  return {
    id: data.id as string,
    symbol: data.symbol as string,
    exchange: data.exchange as string,
    baseAsset: (data.baseAsset as string) || '',
    quoteAsset: (data.quoteAsset as string) || '',
    status: data.status as Symbol['status'],
    enabledByAdmin,
    isStreaming: (data.isStreaming as boolean) ?? false,
    isProcessing: (data.isProcessing as boolean) ?? false,
    config: {
      tickValue: (config?.tickValue as number) ?? 0,
      pricePrecision:
        (data.pricePrecision as number) ??
        (config?.pricePrecision as number) ??
        8,
      quantityPrecision:
        (data.quantityPrecision as number) ??
        (config?.quantityPrecision as number) ??
        8,
    },
    exchangeMetadata: exchangeMetadata as Symbol['exchangeMetadata'],
    lastSyncAt: data.lastSyncAt ? new Date(data.lastSyncAt as string) : null,
    createdAt: new Date(data.createdAt as string),
    updatedAt: new Date(data.updatedAt as string),
  };
}
