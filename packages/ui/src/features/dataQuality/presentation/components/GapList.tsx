/**
 * GapList Component
 *
 * Displays a list of trade data gaps with sorting and CSV export.
 * Shows: from timestamp, to timestamp, duration (human readable)
 *
 * @requirements 3.3 - Presentation layer with components, hooks, and pages
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import type { TradeGap, GapSortBy, GapSortOrder } from '../../domain/types';

/**
 * GapList component props
 */
interface GapListProps {
  /** List of gaps to display */
  gaps: TradeGap[];
  /** Symbol name for display and export */
  symbol?: string;
  /** Exchange name for display and export */
  exchange?: string;
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
 * Format timestamp to readable date/time
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Sort gaps by specified criteria
 */
function sortGaps(
  gaps: TradeGap[],
  sortBy: GapSortBy,
  sortOrder: GapSortOrder
): TradeGap[] {
  return [...gaps].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'duration') {
      comparison = a.duration - b.duration;
    } else {
      comparison = a.from - b.from;
    }
    return sortOrder === 'desc' ? -comparison : comparison;
  });
}

/**
 * Generate CSV content from gaps
 */
function generateCSV(
  gaps: TradeGap[],
  symbol?: string,
  exchange?: string
): string {
  const headers = [
    'From',
    'To',
    'Duration (ms)',
    'Duration (readable)',
    'Symbol',
    'Exchange',
  ];
  const rows = gaps.map((gap) => [
    new Date(gap.from).toISOString(),
    new Date(gap.to).toISOString(),
    gap.duration.toString(),
    formatDuration(gap.duration),
    symbol || '',
    exchange || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Download CSV file
 */
function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * GapList component
 *
 * Displays gaps in a table with sorting and export functionality.
 */
export function GapList({ gaps, symbol, exchange }: GapListProps) {
  const [sortBy, setSortBy] = useState<GapSortBy>('duration');
  const [sortOrder, setSortOrder] = useState<GapSortOrder>('desc');

  // Sort gaps
  const sortedGaps = useMemo(
    () => sortGaps(gaps, sortBy, sortOrder),
    [gaps, sortBy, sortOrder]
  );

  // Handle sort change
  const handleSortChange = useCallback(
    (newSortBy: GapSortBy) => {
      if (newSortBy === sortBy) {
        // Toggle order if same column
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(newSortBy);
        setSortOrder('desc');
      }
    },
    [sortBy]
  );

  // Handle CSV export
  const handleExport = useCallback(() => {
    const csv = generateCSV(sortedGaps, symbol, exchange);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `trade-gaps-${symbol || 'unknown'}-${
      exchange || 'unknown'
    }-${timestamp}.csv`;
    downloadCSV(csv, filename);
  }, [sortedGaps, symbol, exchange]);

  // Get sort indicator
  const getSortIndicator = (column: GapSortBy) => {
    if (sortBy !== column) return '';
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  if (gaps.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gap List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No gaps found. Your data is complete! 🎉
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">
          Gap List{' '}
          <span className="text-muted-foreground">({gaps.length})</span>
        </CardTitle>
        <Button onClick={handleExport} variant="outline" size="sm">
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-sm text-muted-foreground">
                <th
                  className="px-4 py-3 font-medium cursor-pointer hover:text-foreground"
                  onClick={() => handleSortChange('time')}
                >
                  From{getSortIndicator('time')}
                </th>
                <th className="px-4 py-3 font-medium">To</th>
                <th
                  className="px-4 py-3 font-medium cursor-pointer hover:text-foreground"
                  onClick={() => handleSortChange('duration')}
                >
                  Duration{getSortIndicator('duration')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedGaps.map((gap) => (
                <tr
                  key={`${gap.from}-${gap.to}`}
                  className="border-b border-border hover:bg-muted/50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-mono">
                    {formatTimestamp(gap.from)}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono">
                    {formatTimestamp(gap.to)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`font-medium ${
                        gap.duration > 3600000
                          ? 'text-red-600 dark:text-red-400'
                          : gap.duration > 60000
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-foreground'
                      }`}
                    >
                      {formatDuration(gap.duration)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
