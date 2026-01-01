/**
 * SyncStatus Component
 *
 * Displays symbol sync status and results.
 * Shows cronjob sync results: symbolsAdded, symbolsUpdated, symbolsDelisted
 * Includes manual sync trigger button.
 *
 * @requirements 3.3 - Presentation layer with components, hooks, and pages
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSymbolSync } from '../hooks/useSymbolSync';
import {
  useSymbolWebSocket,
  type SymbolSyncCompleteEvent,
} from '../hooks/useSymbolWebSocket';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';

/**
 * Format date to readable string
 */
function formatDate(date: Date): string {
  return date.toLocaleString();
}

/**
 * Sync result display component
 */
interface SyncResultDisplayProps {
  exchange: string;
  symbolsAdded: number;
  symbolsUpdated: number;
  symbolsDelisted: number;
  syncedAt: Date;
  isRealtime?: boolean;
}

function SyncResultDisplay({
  exchange,
  symbolsAdded,
  symbolsUpdated,
  symbolsDelisted,
  syncedAt,
  isRealtime,
}: SyncResultDisplayProps) {
  return (
    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">{exchange}</div>
        {isRealtime && (
          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
            Real-time
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            +{symbolsAdded}
          </div>
          <div className="text-xs text-muted-foreground">Added</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {symbolsUpdated}
          </div>
          <div className="text-xs text-muted-foreground">Updated</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            -{symbolsDelisted}
          </div>
          <div className="text-xs text-muted-foreground">Delisted</div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground text-right">
        Synced at {formatDate(syncedAt)}
      </div>
    </div>
  );
}

/**
 * Exchange selector for sync
 */
interface ExchangeSyncSelectorProps {
  exchanges: string[];
  selectedExchange: string;
  onSelect: (exchange: string) => void;
  disabled?: boolean;
}

function ExchangeSyncSelector({
  exchanges,
  selectedExchange,
  onSelect,
  disabled,
}: ExchangeSyncSelectorProps) {
  return (
    <select
      value={selectedExchange}
      onChange={(e) => onSelect(e.target.value)}
      disabled={disabled}
      className="px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
    >
      {exchanges.map((exchange) => (
        <option key={exchange} value={exchange}>
          {exchange}
        </option>
      ))}
    </select>
  );
}

/**
 * SyncStatus component props
 */
interface SyncStatusProps {
  exchanges?: string[];
  initialExchange?: string;
  onSyncComplete?: () => void;
}

/**
 * SyncStatus component
 *
 * Displays sync status and provides manual sync trigger.
 */
export function SyncStatus({
  exchanges = ['binance', 'okx', 'bybit', 'deribit'],
  initialExchange,
  onSyncComplete,
}: SyncStatusProps) {
  const [selectedExchange, setSelectedExchange] = useState<string>(
    initialExchange || exchanges[0] || 'binance'
  );
  const [realtimeSyncEvents, setRealtimeSyncEvents] = useState<
    SymbolSyncCompleteEvent[]
  >([]);

  const { syncing, lastSyncResult, error, syncSymbols, clearError } =
    useSymbolSync();

  // Handle real-time sync complete events
  const handleSyncComplete = useCallback(
    (event: SymbolSyncCompleteEvent) => {
      setRealtimeSyncEvents((prev) => [event, ...prev.slice(0, 4)]); // Keep last 5
      onSyncComplete?.();
    },
    [onSyncComplete]
  );

  const { subscribe, connected } = useSymbolWebSocket(
    undefined,
    handleSyncComplete
  );

  // Subscribe to sync events on mount
  useEffect(() => {
    subscribe();
  }, [subscribe]);

  const handleSync = async () => {
    clearError();
    const result = await syncSymbols(selectedExchange);
    if (result?.success) {
      onSyncComplete?.();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">Symbol Sync</CardTitle>
          {connected && (
            <span
              className="w-2 h-2 rounded-full bg-green-500"
              title="Real-time updates connected"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <ExchangeSyncSelector
            exchanges={exchanges}
            selectedExchange={selectedExchange}
            onSelect={setSelectedExchange}
            disabled={syncing}
          />
          <Button onClick={handleSync} disabled={syncing} size="sm">
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error display */}
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm flex items-center justify-between">
            <span>{error}</span>
            <Button
              onClick={clearError}
              variant="ghost"
              size="sm"
              className="h-auto p-1"
            >
              ×
            </Button>
          </div>
        )}

        {/* Last manual sync result */}
        {lastSyncResult && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Last Manual Sync
            </h3>
            <SyncResultDisplay
              exchange={lastSyncResult.exchange}
              symbolsAdded={lastSyncResult.symbolsAdded}
              symbolsUpdated={lastSyncResult.symbolsUpdated}
              symbolsDelisted={lastSyncResult.symbolsDelisted}
              syncedAt={lastSyncResult.syncedAt}
            />
          </div>
        )}

        {/* Real-time sync events */}
        {realtimeSyncEvents.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Recent Sync Events
            </h3>
            <div className="space-y-2">
              {realtimeSyncEvents.map((event, index) => (
                <SyncResultDisplay
                  key={`${event.exchange}-${event.syncedAt.getTime()}-${index}`}
                  exchange={event.exchange}
                  symbolsAdded={event.symbolsAdded}
                  symbolsUpdated={event.symbolsUpdated}
                  symbolsDelisted={event.symbolsDelisted}
                  syncedAt={event.syncedAt}
                  isRealtime
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!lastSyncResult && realtimeSyncEvents.length === 0 && !error && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No sync results yet.</p>
            <p className="text-sm mt-1">
              Select an exchange and click &quot;Sync Now&quot; to sync symbols.
            </p>
          </div>
        )}

        {/* Syncing indicator */}
        {syncing && (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Syncing {selectedExchange} symbols...
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
