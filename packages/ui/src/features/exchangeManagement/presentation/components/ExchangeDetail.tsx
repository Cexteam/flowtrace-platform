/**
 * ExchangeDetail Component
 *
 * Displays detailed information about a specific exchange.
 * Shows: supported features, API status, sync history
 *
 * @requirements 3.3 - Presentation layer with components, hooks, and pages
 */

'use client';

import { useExchangeHealth } from '../hooks/useExchangeHealth';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import type {
  Exchange,
  ExchangeFeatures,
  ExchangeSyncHistoryEntry,
} from '../../domain/types';

/**
 * Format date to readable string
 */
function formatDate(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Feature item component
 */
interface FeatureItemProps {
  name: string;
  enabled: boolean;
}

function FeatureItem({ name, enabled }: FeatureItemProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm">{name}</span>
      {enabled ? (
        <span className="text-green-600 dark:text-green-400">✓</span>
      ) : (
        <span className="text-gray-400">✗</span>
      )}
    </div>
  );
}

/**
 * Features section component
 */
interface FeaturesSectionProps {
  features: ExchangeFeatures;
}

function FeaturesSection({ features }: FeaturesSectionProps) {
  const featureList = [
    { name: 'Spot Trading', enabled: features.spotTrading },
    { name: 'Futures Trading', enabled: features.futuresTrading },
    { name: 'Margin Trading', enabled: features.marginTrading },
    { name: 'WebSocket Streaming', enabled: features.websocketStreaming },
    { name: 'Historical Data', enabled: features.historicalData },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Supported Features</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {featureList.map((feature) => (
            <FeatureItem
              key={feature.name}
              name={feature.name}
              enabled={feature.enabled}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * API Status section component
 */
interface ApiStatusSectionProps {
  exchange: Exchange;
  healthLoading: boolean;
  healthError: string | null;
  onCheckHealth: () => void;
}

function ApiStatusSection({
  exchange,
  healthLoading,
  healthError,
  onCheckHealth,
}: ApiStatusSectionProps) {
  const getApiStatusColor = (status: Exchange['apiStatus']) => {
    switch (status) {
      case 'online':
        return 'text-green-600 dark:text-green-400';
      case 'offline':
        return 'text-red-600 dark:text-red-400';
      case 'maintenance':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">API Status</CardTitle>
        <Button
          onClick={onCheckHealth}
          variant="outline"
          size="sm"
          disabled={healthLoading}
        >
          {healthLoading ? 'Checking...' : 'Check Health'}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <span
              className={`font-medium capitalize ${getApiStatusColor(
                exchange.apiStatus
              )}`}
            >
              {exchange.apiStatus}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Health</span>
            <span
              className={`font-medium capitalize ${
                exchange.healthStatus === 'healthy'
                  ? 'text-green-600 dark:text-green-400'
                  : exchange.healthStatus === 'degraded'
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : exchange.healthStatus === 'unhealthy'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {exchange.healthStatus}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Last Check</span>
            <span className="text-sm">
              {exchange.lastHealthCheck
                ? formatDate(exchange.lastHealthCheck)
                : 'Never'}
            </span>
          </div>
          {healthError && (
            <div className="text-sm text-destructive mt-2">
              Error: {healthError}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Sync history entry component
 */
interface SyncHistoryEntryProps {
  entry: ExchangeSyncHistoryEntry;
}

function SyncHistoryEntryRow({ entry }: SyncHistoryEntryProps) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-2 text-sm">{formatDate(entry.syncedAt)}</td>
      <td className="px-3 py-2 text-center">
        {entry.success ? (
          <span className="text-green-600 dark:text-green-400">✓</span>
        ) : (
          <span className="text-red-600 dark:text-red-400">✗</span>
        )}
      </td>
      <td className="px-3 py-2 text-center text-sm text-green-600 dark:text-green-400">
        +{entry.symbolsAdded}
      </td>
      <td className="px-3 py-2 text-center text-sm text-blue-600 dark:text-blue-400">
        ~{entry.symbolsUpdated}
      </td>
      <td className="px-3 py-2 text-center text-sm text-red-600 dark:text-red-400">
        -{entry.symbolsDelisted}
      </td>
    </tr>
  );
}

/**
 * Sync history section component
 */
interface SyncHistorySectionProps {
  syncHistory: ExchangeSyncHistoryEntry[];
}

function SyncHistorySection({ syncHistory }: SyncHistorySectionProps) {
  const recentHistory = syncHistory.slice(0, 10); // Show last 10 entries

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sync History</CardTitle>
      </CardHeader>
      <CardContent>
        {recentHistory.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No sync history available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-center font-medium">Status</th>
                  <th className="px-3 py-2 text-center font-medium">Added</th>
                  <th className="px-3 py-2 text-center font-medium">Updated</th>
                  <th className="px-3 py-2 text-center font-medium">
                    Delisted
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentHistory.map((entry, index) => (
                  <SyncHistoryEntryRow key={index} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * ExchangeDetail component props
 */
interface ExchangeDetailProps {
  exchange: Exchange;
  onBack?: () => void;
}

/**
 * ExchangeDetail component
 *
 * Displays detailed information about a specific exchange.
 */
export function ExchangeDetail({ exchange, onBack }: ExchangeDetailProps) {
  const {
    loading: healthLoading,
    error: healthError,
    checkHealth,
  } = useExchangeHealth(
    exchange.name,
    0 // Disable auto-check, manual only
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            {onBack && (
              <Button onClick={onBack} variant="ghost" size="sm">
                ← Back
              </Button>
            )}
            <h2 className="text-xl font-bold">{exchange.displayName}</h2>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                exchange.isEnabled
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
              }`}
            >
              {exchange.isEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {exchange.symbolCount} symbols •{' '}
            {exchange.implementationStatus === 'implemented'
              ? 'Implemented'
              : 'Not Implemented'}
          </p>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <FeaturesSection features={exchange.features} />
          <ApiStatusSection
            exchange={exchange}
            healthLoading={healthLoading}
            healthError={healthError}
            onCheckHealth={checkHealth}
          />
        </div>

        {/* Right Column */}
        <div>
          <SyncHistorySection syncHistory={exchange.syncHistory} />
        </div>
      </div>

      {/* Metadata */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <div>
              <span className="font-medium">Created:</span>{' '}
              {formatDate(exchange.createdAt)}
            </div>
            <div>
              <span className="font-medium">Updated:</span>{' '}
              {formatDate(exchange.updatedAt)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
