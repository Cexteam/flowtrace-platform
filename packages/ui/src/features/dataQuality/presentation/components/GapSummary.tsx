/**
 * GapSummary Component
 *
 * Displays summary statistics for trade data gaps.
 * Shows: totalGaps, totalMissingDuration, dataCompleteness percentage
 *
 * @requirements 3.3 - Presentation layer with components, hooks, and pages
 */

'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';
import type { CheckTradeGapsResponse } from '../../domain/types';

/**
 * GapSummary component props
 */
interface GapSummaryProps {
  /** Gap check result data */
  result: CheckTradeGapsResponse;
}

/**
 * Format duration in human readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * Get completeness color class based on percentage
 */
function getCompletenessColor(percentage: number): string {
  if (percentage >= 99) return 'text-green-600 dark:text-green-400';
  if (percentage >= 95) return 'text-yellow-600 dark:text-yellow-400';
  if (percentage >= 90) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Get completeness background color class
 */
function getCompletenessBarColor(percentage: number): string {
  if (percentage >= 99) return 'bg-green-500';
  if (percentage >= 95) return 'bg-yellow-500';
  if (percentage >= 90) return 'bg-orange-500';
  return 'bg-red-500';
}

/**
 * Format date range for display
 */
function formatDateRange(fromTime: number, toTime: number): string {
  const from = new Date(fromTime);
  const to = new Date(toTime);

  const formatDate = (date: Date) =>
    date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

  return `${formatDate(from)} → ${formatDate(to)}`;
}

/**
 * Stat card component
 */
interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  colorClass?: string;
}

function StatCard({ label, value, subValue, colorClass }: StatCardProps) {
  return (
    <div className="bg-muted/50 rounded-lg p-4">
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorClass || 'text-foreground'}`}>
        {value}
      </p>
      {subValue && (
        <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
      )}
    </div>
  );
}

/**
 * GapSummary component
 *
 * Displays summary statistics for gap check results.
 */
export function GapSummary({ result }: GapSummaryProps) {
  const completenessColor = getCompletenessColor(result.dataCompleteness);
  const barColor = getCompletenessBarColor(result.dataCompleteness);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Summary</CardTitle>
        <p className="text-sm text-muted-foreground">
          {result.symbol} on {result.exchange} •{' '}
          {formatDateRange(result.fromTime, result.toTime)}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Total Gaps"
            value={result.totalGaps}
            subValue={result.totalGaps === 0 ? 'Perfect!' : undefined}
            colorClass={
              result.totalGaps === 0
                ? 'text-green-600 dark:text-green-400'
                : undefined
            }
          />
          <StatCard
            label="Missing Duration"
            value={formatDuration(result.totalMissingDuration)}
            subValue={result.totalMissingDuration === 0 ? 'No gaps' : undefined}
          />
          <StatCard
            label="Data Completeness"
            value={`${result.dataCompleteness.toFixed(2)}%`}
            colorClass={completenessColor}
          />
        </div>

        {/* Completeness bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Data Coverage</span>
            <span className={completenessColor}>
              {result.dataCompleteness.toFixed(2)}%
            </span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} transition-all duration-500`}
              style={{ width: `${Math.min(100, result.dataCompleteness)}%` }}
            />
          </div>
        </div>

        {/* Check timestamp */}
        <p className="text-xs text-muted-foreground text-right">
          Checked at {result.checkedAt.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}
