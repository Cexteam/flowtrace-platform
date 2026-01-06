/**
 * WorkerDetail Component
 *
 * Displays detailed information about a single worker.
 * Shows: Worker ID, Status, Uptime, CPU Usage, Memory Usage,
 * Assigned Symbols, Health Indicators
 *
 * Requirements: 7.1, 7.2, 7.3, 7.5, 4.2, 4.3, 4.5
 */

'use client';

import { useWorkerDetail } from '../hooks/useWorkerDetail';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { WorkerHealthBadge } from './WorkerHealthBadge';
import type { WorkerHealthMetrics, WorkerState } from '../../domain/types';
import {
  MEMORY_THRESHOLDS,
  getQueueLengthVariant,
  getQueueLengthStatus,
  getLatencyVariant,
  getLatencyStatus,
  getThroughputVariant,
  getCpuVariant,
  getMemoryVariant,
} from '../../domain/constants';

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Format uptime seconds to human readable string
 */
function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours < 24) return `${hours}h ${minutes}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

/**
 * Format date to relative time
 */
function formatRelativeTime(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

/**
 * Get state badge variant
 */
function getStateBadgeVariant(
  state: WorkerState
): 'success' | 'secondary' | 'warning' | 'destructive' | 'default' {
  switch (state) {
    case 'running':
      return 'success';
    case 'idle':
      return 'secondary';
    case 'stopping':
      return 'warning';
    case 'stopped':
      return 'secondary';
    case 'error':
      return 'destructive';
    default:
      return 'default';
  }
}

/**
 * Stat card component for displaying metrics
 */
interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

function StatCard({
  label,
  value,
  subValue,
  variant = 'default',
}: StatCardProps) {
  const variantClasses = {
    default: '',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className="bg-muted/50 rounded-lg p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${variantClasses[variant]}`}>
        {value}
      </div>
      {subValue && (
        <div className="text-xs text-muted-foreground mt-1">{subValue}</div>
      )}
    </div>
  );
}

/**
 * Health metrics display component
 * Requirements: 7.2, 7.4, 4.2, 4.3, 4.5
 */
interface HealthMetricsProps {
  metrics: WorkerHealthMetrics;
  cpuUsage?: number;
}

function HealthMetricsDisplay({ metrics, cpuUsage }: HealthMetricsProps) {
  const memoryUsage = metrics?.memoryUsageBytes ?? 0;

  // Per-worker metrics (Requirements 4.2, 4.3, 4.5)
  const queueLength = metrics?.queueLength ?? 0;
  const processingLatencyMs = metrics?.processingLatencyMs ?? 0;
  const throughputTradesPerSecond = metrics?.throughputTradesPerSecond ?? 0;

  // Calculate memory percentage using constant
  const memoryPercent = (memoryUsage / MEMORY_THRESHOLDS.LIMIT_BYTES) * 100;

  // Determine variants using imported functions from constants
  const cpuVariant = getCpuVariant(cpuUsage);
  const memoryVariant = getMemoryVariant(memoryPercent);

  // Per-worker metric variants
  const queueVariant = getQueueLengthVariant(queueLength);
  const latencyVariant = getLatencyVariant(processingLatencyMs);
  const throughputVariant = getThroughputVariant(throughputTradesPerSecond);

  return (
    <div className="space-y-4">
      {/* Performance Metrics - Requirements 4.2, 4.3, 4.5 */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3">
          Performance Metrics
          <span className="ml-2 text-xs font-normal">(per-worker)</span>
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            label="Queue Length"
            value={queueLength}
            subValue={getQueueLengthStatus(queueLength)}
            variant={queueVariant}
          />
          <StatCard
            label="Processing Latency"
            value={`${processingLatencyMs.toFixed(2)} ms`}
            subValue={getLatencyStatus(processingLatencyMs)}
            variant={latencyVariant}
          />
          <StatCard
            label="Throughput"
            value={`${throughputTradesPerSecond.toFixed(1)}/s`}
            subValue="trades per second"
            variant={throughputVariant}
          />
        </div>
      </div>

      {/* Resource Usage - Requirements 7.2 */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3">
          Resource Usage
          <span className="ml-2 text-xs font-normal">(per-worker)</span>
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="CPU Usage"
            value={cpuUsage !== undefined ? `${cpuUsage.toFixed(1)}%` : '-'}
            subValue="processing time ratio"
            variant={cpuVariant}
          />
          <StatCard
            label="V8 Heap Memory"
            value={formatBytes(memoryUsage)}
            subValue={`${memoryPercent.toFixed(1)}%`}
            variant={memoryVariant}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Assigned symbols list component
 * Requirements: 7.3
 */
interface AssignedSymbolsProps {
  symbols: string[];
}

function AssignedSymbolsList({ symbols }: AssignedSymbolsProps) {
  if (symbols.length === 0) {
    return (
      <div className="text-muted-foreground text-sm py-4 text-center">
        No symbols assigned to this worker
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
      {symbols.map((symbol) => (
        <span
          key={symbol}
          className="px-2 py-1 bg-muted rounded text-sm font-mono"
        >
          {symbol}
        </span>
      ))}
    </div>
  );
}

/**
 * WorkerDetail component props
 */
interface WorkerDetailProps {
  workerId: string | null;
  onClose?: () => void;
  autoRefreshInterval?: number;
}

/**
 * WorkerDetail component
 *
 * Displays detailed worker information with health metrics.
 * Auto-refreshes every 5 seconds when detail panel is open.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */
export function WorkerDetail({
  workerId,
  onClose,
  autoRefreshInterval = 5000,
}: WorkerDetailProps) {
  const { worker, healthMetrics, loading, error, refresh } = useWorkerDetail(
    workerId,
    autoRefreshInterval
  );

  if (!workerId) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <svg
              className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
              />
            </svg>
            <p>Select a worker to view details</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Worker Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <svg
              className="w-12 h-12 mx-auto mb-4 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={refresh} variant="outline">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading && !worker) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Worker Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-8 bg-muted animate-pulse rounded" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!worker) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            Worker not found
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="space-y-1">
          {/* Worker ID - Requirements 7.1 */}
          <CardTitle className="text-lg font-mono">{worker.workerId}</CardTitle>
          <CardDescription className="flex items-center gap-4">
            {/* Uptime - Requirements 7.1 */}
            <span>Uptime: {formatUptime(worker.uptimeSeconds)}</span>
            <span>•</span>
            <span>
              Last activity: {formatRelativeTime(worker.lastActivityAt)}
            </span>
          </CardDescription>
        </div>
        <div className="flex items-center gap-3">
          {/* Status Badge - Requirements 7.1 */}
          <Badge variant={getStateBadgeVariant(worker.state)}>
            {worker.state}
          </Badge>
          {/* Health Indicator - Requirements 7.5 */}
          <WorkerHealthBadge worker={worker} showLabel={false} />
          {onClose && (
            <Button onClick={onClose} variant="ghost" size="sm">
              ✕
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Health Metrics - Requirements 7.2, 7.4 */}
        {/* Use healthMetrics from separate fetch, or fall back to worker.healthMetrics */}
        {healthMetrics || worker.healthMetrics ? (
          <HealthMetricsDisplay
            metrics={healthMetrics || worker.healthMetrics!}
            cpuUsage={
              healthMetrics?.cpuUsagePercent ??
              worker.healthMetrics?.cpuUsagePercent ??
              worker.cpuUsage
            }
          />
        ) : (
          <div className="text-muted-foreground text-sm py-4 text-center">
            Health metrics not available
          </div>
        )}

        {/* Assigned Symbols - Requirements 7.3 */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">
            Assigned Symbols ({worker.assignedSymbols.length})
          </h4>
          <AssignedSymbolsList symbols={worker.assignedSymbols} />
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            Auto-refreshing every {autoRefreshInterval / 1000}s
          </div>
          <Button
            onClick={refresh}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh Now'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
