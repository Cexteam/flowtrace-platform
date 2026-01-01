/**
 * SymbolDetail Component
 *
 * Displays detailed information about a single symbol.
 * Shows: config (tickValue, pricePrecision, quantityPrecision), exchangeMetadata
 * Includes Activate/Deactivate buttons.
 *
 * @requirements 3.3 - Presentation layer with components, hooks, and pages
 */

'use client';

import { useSymbolDetail } from '../hooks/useSymbolDetail';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import type {
  Symbol,
  SymbolStatus,
  ExchangeMetadata,
} from '../../domain/types';

/**
 * Get status badge color classes
 */
function getStatusBadgeClasses(status: SymbolStatus): string {
  const baseClasses = 'px-3 py-1 rounded-full text-sm font-medium';
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
 * Format date to readable string
 */
function formatDate(date: Date | null): string {
  if (!date) return 'N/A';
  return date.toLocaleString();
}

/**
 * Config section component
 */
interface ConfigSectionProps {
  config: Symbol['config'];
}

function ConfigSection({ config }: ConfigSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        Configuration
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="text-xs text-muted-foreground">Tick Value</div>
          <div className="text-lg font-mono">{config.tickValue}</div>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="text-xs text-muted-foreground">Price Precision</div>
          <div className="text-lg font-mono">{config.pricePrecision}</div>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="text-xs text-muted-foreground">
            Quantity Precision
          </div>
          <div className="text-lg font-mono">{config.quantityPrecision}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Exchange metadata section component
 */
interface MetadataSectionProps {
  metadata: ExchangeMetadata | null;
}

function MetadataSection({ metadata }: MetadataSectionProps) {
  if (!metadata) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Exchange Metadata
        </h3>
        <div className="text-muted-foreground text-sm">
          No exchange metadata available
        </div>
      </div>
    );
  }

  // Filter out null/undefined values and format for display
  const entries = Object.entries(metadata).filter(
    ([, value]) => value !== null && value !== undefined
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        Exchange Metadata
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map(([key, value]) => (
          <div key={key} className="p-3 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </div>
            <div className="text-sm font-mono truncate" title={String(value)}>
              {typeof value === 'number'
                ? value.toLocaleString()
                : String(value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Status indicators component
 */
interface StatusIndicatorsProps {
  symbol: Symbol;
}

function StatusIndicators({ symbol }: StatusIndicatorsProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Streaming:</span>
        {symbol.isStreaming ? (
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Active
          </span>
        ) : (
          <span className="flex items-center gap-1 text-gray-500">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            Inactive
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Processing:</span>
        {symbol.isProcessing ? (
          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Active
          </span>
        ) : (
          <span className="flex items-center gap-1 text-gray-500">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            Inactive
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * SymbolDetail component props
 */
interface SymbolDetailProps {
  symbolId: string;
  onBack?: () => void;
}

/**
 * SymbolDetail component
 *
 * Displays detailed symbol information with activate/deactivate controls.
 */
export function SymbolDetail({ symbolId, onBack }: SymbolDetailProps) {
  const { symbol, loading, error, toggling, refresh, activate, deactivate } =
    useSymbolDetail(symbolId);

  const handleActivate = async () => {
    const result = await activate();
    if (result?.success) {
      // Optionally show success toast
    }
  };

  const handleDeactivate = async () => {
    const result = await deactivate();
    if (result?.success) {
      // Optionally show success toast
    }
  };

  if (loading && !symbol) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            Loading symbol details...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !symbol) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Symbol Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-destructive mb-4">{error}</p>
            <div className="flex justify-center gap-2">
              {onBack && (
                <Button onClick={onBack} variant="outline">
                  Back
                </Button>
              )}
              <Button onClick={refresh} variant="outline">
                Retry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!symbol) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            Symbol not found
          </div>
        </CardContent>
      </Card>
    );
  }

  const canActivate =
    symbol.status === 'inactive' || symbol.status === 'pending_review';
  const canDeactivate = symbol.status === 'active';

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between flex-wrap gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button onClick={onBack} variant="ghost" size="sm">
                ← Back
              </Button>
            )}
            <CardTitle className="text-xl font-mono">{symbol.symbol}</CardTitle>
            <span className={getStatusBadgeClasses(symbol.status)}>
              {symbol.status.replace('_', ' ')}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            {symbol.exchange} • {symbol.baseAsset}/{symbol.quoteAsset}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canActivate && (
            <Button
              onClick={handleActivate}
              disabled={toggling}
              variant="default"
              size="sm"
            >
              {toggling ? 'Activating...' : 'Activate'}
            </Button>
          )}
          {canDeactivate && (
            <Button
              onClick={handleDeactivate}
              disabled={toggling}
              variant="destructive"
              size="sm"
            >
              {toggling ? 'Deactivating...' : 'Deactivate'}
            </Button>
          )}
          <Button
            onClick={refresh}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Indicators */}
        <StatusIndicators symbol={symbol} />

        {/* Configuration */}
        <ConfigSection config={symbol.config} />

        {/* Exchange Metadata */}
        <MetadataSection metadata={symbol.exchangeMetadata} />

        {/* Timestamps */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Timestamps
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Last Sync:</span>{' '}
              <span className="font-mono">{formatDate(symbol.lastSyncAt)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>{' '}
              <span className="font-mono">{formatDate(symbol.createdAt)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Updated:</span>{' '}
              <span className="font-mono">{formatDate(symbol.updatedAt)}</span>
            </div>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
