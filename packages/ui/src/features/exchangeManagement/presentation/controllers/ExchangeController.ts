/**
 * ExchangeController - API Functions for Exchange Management
 *
 * API functions that make HTTP requests to the backend or use IPC in Electron.
 * Follows the Controller → Hook → Component pattern.
 * Works in both SSR and client-side (including Electron static export).
 *
 */

import type {
  Exchange,
  ExchangeHealthCheck,
  ExchangeToggleResult,
} from '../../domain/types';
import type {
  GetExchangesRequest,
  GetExchangesResponse,
} from '../../application/ports/out/ExchangeApiPort';

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
 * Get exchanges list
 *
 * @param request - Optional filter parameters
 * @returns Server action result with exchanges data
 */
export async function getExchangesAction(
  request?: GetExchangesRequest
): Promise<ServerActionResult<GetExchangesResponse>> {
  try {
    // Use IPC in Electron, HTTP otherwise
    const electronAPI = getElectronAPI();

    console.log('[ExchangeController] getExchangesAction called', {
      isElectron: !!electronAPI,
      request,
    });

    if (electronAPI) {
      // Electron: Use IPC
      console.log('[ExchangeController] Using IPC to fetch exchanges');
      const data = await electronAPI.invoke<{
        exchanges: Record<string, unknown>[];
        total: number;
      }>('exchanges:getAll', request);
      console.log('[ExchangeController] IPC response:', data);
      return {
        success: true,
        data: {
          exchanges: data.exchanges.map(mapExchangeFromApi),
          total: data.total,
        },
      };
    }

    // Web: Use HTTP API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    console.log(
      '[ExchangeController] Using HTTP to fetch exchanges from',
      apiUrl
    );

    const params = new URLSearchParams();
    if (request?.implementationStatus)
      params.append('implementationStatus', request.implementationStatus);
    if (request?.healthStatus)
      params.append('healthStatus', request.healthStatus);
    if (request?.isEnabled !== undefined)
      params.append('isEnabled', request.isEnabled.toString());
    if (request?.limit) params.append('limit', request.limit.toString());
    if (request?.offset) params.append('offset', request.offset.toString());

    const queryString = params.toString();
    const url = `${apiUrl}/exchanges${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch exchanges: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: {
        exchanges: data.exchanges.map(mapExchangeFromApi),
        total: data.total,
      },
    };
  } catch (err) {
    console.error('[ExchangeController] Error fetching exchanges:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get exchange health check
 *
 * @param exchangeName - Exchange name
 * @returns Server action result with health check data
 */
export async function getExchangeHealthAction(
  exchangeName: string
): Promise<ServerActionResult<ExchangeHealthCheck>> {
  try {
    // Use IPC in Electron, HTTP otherwise
    const electronAPI = getElectronAPI();

    if (electronAPI) {
      // Electron: Use IPC
      const data = await electronAPI.invoke<Record<string, unknown>>(
        'exchanges:getHealth',
        { exchangeName }
      );
      return {
        success: true,
        data: {
          status: data.status as ExchangeHealthCheck['status'],
          latencyMs: data.latencyMs as number,
          lastCheckedAt: new Date(data.lastCheckedAt as string),
          errorMessage: data.errorMessage as string | undefined,
        },
      };
    }

    // Web: Use HTTP API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/exchanges/${exchangeName}/health`, {
      cache: 'no-store',
    });

    if (response.status === 404) {
      return {
        success: false,
        error: 'Exchange health not found',
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch exchange health: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: {
        status: data.status,
        latencyMs: data.latencyMs,
        lastCheckedAt: new Date(data.lastCheckedAt),
        errorMessage: data.errorMessage,
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
 * Enable an exchange
 *
 * @param exchangeName - Exchange name
 * @returns Server action result with toggle result
 */
export async function enableExchangeAction(
  exchangeName: string
): Promise<ServerActionResult<ExchangeToggleResult>> {
  try {
    const electronAPI = getElectronAPI();

    if (electronAPI) {
      // Electron: Use IPC
      const data = await electronAPI.invoke<{
        success: boolean;
        message?: string;
      }>('exchanges:enable', { exchangeName });
      return {
        success: data.success,
        data: {
          success: data.success,
          exchangeName,
          isEnabled: true,
          message: data.message,
        },
        error: data.success ? undefined : data.message,
      };
    }

    // Web: Use HTTP API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/exchanges/${exchangeName}/enable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error:
          data.message || `Failed to enable exchange: ${response.statusText}`,
      };
    }

    return {
      success: true,
      data: {
        success: true,
        exchangeName,
        isEnabled: true,
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
 * Disable an exchange
 *
 * @param exchangeName - Exchange name
 * @returns Server action result with toggle result
 */
export async function disableExchangeAction(
  exchangeName: string
): Promise<ServerActionResult<ExchangeToggleResult>> {
  try {
    const electronAPI = getElectronAPI();

    if (electronAPI) {
      // Electron: Use IPC
      const data = await electronAPI.invoke<{
        success: boolean;
        message?: string;
      }>('exchanges:disable', { exchangeName });
      return {
        success: data.success,
        data: {
          success: data.success,
          exchangeName,
          isEnabled: false,
          message: data.message,
        },
        error: data.success ? undefined : data.message,
      };
    }

    // Web: Use HTTP API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(
      `${apiUrl}/exchanges/${exchangeName}/disable`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error:
          data.message || `Failed to disable exchange: ${response.statusText}`,
      };
    }

    return {
      success: true,
      data: {
        success: true,
        exchangeName,
        isEnabled: false,
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
 * Map API response to Exchange domain type
 */
function mapExchangeFromApi(data: Record<string, unknown>): Exchange {
  const features = data.features as Record<string, boolean> | undefined;
  const syncHistory = data.syncHistory as Record<string, unknown>[] | undefined;

  // Map healthStatus from boolean to string
  const healthStatusBool = data.healthStatus as boolean | undefined;
  const healthStatus: Exchange['healthStatus'] =
    healthStatusBool === true
      ? 'healthy'
      : healthStatusBool === false
      ? 'unhealthy'
      : 'unknown';

  // Handle both 'enabled' (from API) and 'isEnabled' (legacy)
  const isEnabled = (data.enabled ?? data.isEnabled ?? false) as boolean;

  console.log('[ExchangeController] mapExchangeFromApi:', {
    name: data.name,
    enabled: data.enabled,
    isEnabled: data.isEnabled,
    mappedIsEnabled: isEnabled,
  });

  return {
    name: data.name as string,
    displayName: (data.displayName as string) || (data.name as string),
    implementationStatus:
      (data.implementationStatus as Exchange['implementationStatus']) ||
      'implemented',
    healthStatus,
    symbolCount: (data.symbolCount as number) || 0,
    lastHealthCheck: data.lastHealthCheck
      ? new Date(data.lastHealthCheck as string)
      : null,
    isEnabled,
    features: {
      spotTrading: features?.spotTrading ?? true,
      futuresTrading: features?.futuresTrading ?? true,
      marginTrading: features?.marginTrading ?? false,
      websocketStreaming: features?.websocketStreaming ?? true,
      historicalData: features?.historicalData ?? true,
    },
    apiStatus: (data.apiStatus as Exchange['apiStatus']) || 'online',
    syncHistory: (syncHistory || []).map((entry) => ({
      syncedAt: new Date(entry.syncedAt as string),
      symbolsAdded: entry.symbolsAdded as number,
      symbolsUpdated: entry.symbolsUpdated as number,
      symbolsDelisted: entry.symbolsDelisted as number,
      success: entry.success as boolean,
      errorMessage: entry.errorMessage as string | undefined,
    })),
    createdAt: data.createdAt ? new Date(data.createdAt as string) : new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt as string) : new Date(),
  };
}
