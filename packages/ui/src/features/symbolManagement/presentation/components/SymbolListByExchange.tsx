/**
 * SymbolListByExchange Component
 *
 * Displays a list of symbols filtered by exchange with status information.
 * Shows: symbol, status, isStreaming, isProcessing, lastSyncAt
 *
 * @requirements 3.3 - Presentation layer with components, hooks, and pages
 * @requirements 8.5 - Real-time status updates via WebSocket
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSymbols } from '../hooks/useSymbols';
import {
  useSymbolWebSocket,
  type SymbolStatusUpdate,
} from '../hooks/useSymbolWebSocket';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import type { Symbol, SymbolStatus } from '../../domain/types';

/**
 * Get status badge color classes
 */
function getStatusBadgeClasses(status: SymbolStatus): string {
  const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
  switch (status) {
    case 'active':
      return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`;
    case 'inactive':
      return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200`;
    case 'delisted':
      return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`;
    case 'pending_review':
      return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200`;
    default:
      return `${baseClasses} bg-gray-100 text-gray-800`;
  }
}

/**
 * Format date to relative time or date string
 */
function formatLastSync(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

/**
 * Symbol row component
 */
interface SymbolRowProps {
  symbol: Symbol;
  onSelect?: (symbolId: string) => void;
}

function SymbolRow({ symbol, onSelect }: SymbolRowProps) {
  return (
    <tr
      className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => onSelect?.(symbol.id)}
    >
      <td className="px-4 py-3 font-mono text-sm">{symbol.symbol}</td>
      <td className="px-4 py-3">
        <span className={getStatusBadgeClasses(symbol.status)}>
          {symbol.status.replace('_', ' ')}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        {symbol.isStreaming ? (
          <span
            className="text-green-600 dark:text-green-400"
            title="Streaming"
          >
            ●
          </span>
        ) : (
          <span className="text-gray-400" title="Not streaming">
            ○
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {symbol.isProcessing ? (
          <span className="text-blue-600 dark:text-blue-400" title="Processing">
            ●
          </span>
        ) : (
          <span className="text-gray-400" title="Not processing">
            ○
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {formatLastSync(symbol.lastSyncAt)}
      </td>
    </tr>
  );
}

/**
 * Exchange selector dropdown
 */
interface ExchangeSelectorProps {
  exchanges: string[];
  selectedExchange: string | undefined;
  onSelect: (exchange: string | undefined) => void;
}

function ExchangeSelector({
  exchanges,
  selectedExchange,
  onSelect,
}: ExchangeSelectorProps) {
  return (
    <select
      value={selectedExchange || ''}
      onChange={(e) => onSelect(e.target.value || undefined)}
      className="px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="">All Exchanges</option>
      {exchanges.map((exchange) => (
        <option key={exchange} value={exchange}>
          {exchange}
        </option>
      ))}
    </select>
  );
}

/**
 * Status filter dropdown
 */
interface StatusFilterProps {
  selectedStatus: SymbolStatus | undefined;
  onSelect: (status: SymbolStatus | undefined) => void;
}

function StatusFilter({ selectedStatus, onSelect }: StatusFilterProps) {
  const statuses: SymbolStatus[] = [
    'active',
    'inactive',
    'delisted',
    'pending_review',
  ];

  return (
    <select
      value={selectedStatus || ''}
      onChange={(e) => onSelect((e.target.value as SymbolStatus) || undefined)}
      className="px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="">All Statuses</option>
      {statuses.map((status) => (
        <option key={status} value={status}>
          {status.replace('_', ' ')}
        </option>
      ))}
    </select>
  );
}

/**
 * SymbolListByExchange component props
 */
interface SymbolListByExchangeProps {
  exchanges?: string[];
  initialExchange?: string;
  onSelectSymbol?: (symbolId: string) => void;
  autoRefreshInterval?: number;
}

/**
 * SymbolListByExchange component
 *
 * Displays symbols in a table with exchange and status filters.
 */
export function SymbolListByExchange({
  exchanges = ['binance', 'okx', 'bybit', 'deribit'],
  initialExchange,
  onSelectSymbol,
  autoRefreshInterval = 10000,
}: SymbolListByExchangeProps) {
  const [selectedExchange, setSelectedExchange] = useState<string | undefined>(
    initialExchange
  );
  const [selectedStatus, setSelectedStatus] = useState<
    SymbolStatus | undefined
  >();

  const {
    symbols,
    total,
    loading,
    error,
    refresh,
    filterByExchange,
    filterByStatus,
  } = useSymbols(initialExchange, autoRefreshInterval);

  // Handle real-time updates
  const handleStatusUpdate = useCallback((update: SymbolStatusUpdate) => {
    // The useSymbols hook will refresh automatically
    // This callback can be used for additional UI updates if needed
    console.log('Symbol status update:', update);
  }, []);

  const { subscribe, connected } = useSymbolWebSocket(handleStatusUpdate);

  // Subscribe to WebSocket updates when symbols change
  useEffect(() => {
    if (symbols.length > 0) {
      const symbolIds = symbols.map((s) => s.id);
      subscribe(symbolIds);
    }
  }, [symbols, subscribe]);

  // Handle exchange filter change
  const handleExchangeChange = useCallback(
    async (exchange: string | undefined) => {
      setSelectedExchange(exchange);
      await filterByExchange(exchange);
    },
    [filterByExchange]
  );

  // Handle status filter change
  const handleStatusChange = useCallback(
    async (status: SymbolStatus | undefined) => {
      setSelectedStatus(status);
      await filterByStatus(status);
    },
    [filterByStatus]
  );

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Symbols</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={refresh} variant="outline">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">
            Symbols{' '}
            {total > 0 && (
              <span className="text-muted-foreground">({total})</span>
            )}
          </CardTitle>
          {connected && (
            <span
              className="w-2 h-2 rounded-full bg-green-500"
              title="Real-time updates connected"
            />
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExchangeSelector
            exchanges={exchanges}
            selectedExchange={selectedExchange}
            onSelect={handleExchangeChange}
          />
          <StatusFilter
            selectedStatus={selectedStatus}
            onSelect={handleStatusChange}
          />
          <Button
            onClick={refresh}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {symbols.length === 0 && !loading ? (
          <div className="text-center py-8 text-muted-foreground">
            No symbols found.{' '}
            {selectedExchange && `Try selecting a different exchange.`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-sm text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Symbol</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-center">
                    Streaming
                  </th>
                  <th className="px-4 py-3 font-medium text-center">
                    Processing
                  </th>
                  <th className="px-4 py-3 font-medium">Last Sync</th>
                </tr>
              </thead>
              <tbody>
                {symbols.map((symbol) => (
                  <SymbolRow
                    key={symbol.id}
                    symbol={symbol}
                    onSelect={onSelectSymbol}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {loading && symbols.length > 0 && (
          <div className="text-center py-2 text-sm text-muted-foreground">
            Updating...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
