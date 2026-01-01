/**
 * GapTable Component
 *
 * Displays gap data in a table using DataTable component.
 * Columns: Symbol, Gap Count, First Gap Time, Last Gap Time, Total Missing Trades, Actions
 * Supports search, filter, pagination, and sorting.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

'use client';

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import {
  DataTable,
  type SortConfig,
} from '../../../../components/ui/table/DataTable';
import { Pagination } from '../../../../components/ui/table/Pagination';
import { SearchInput } from '../../../../components/ui/table/SearchInput';
import { FilterDropdown } from '../../../../components/ui/table/FilterDropdown';
import { GapSeverityBadge } from './GapSeverityBadge';
import { GapSyncButton } from './GapSyncButton';
import type { GapRecord, GapSeverity } from '../../domain/types';

export interface GapTableProps {
  /** Gap records to display */
  gaps: GapRecord[];
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string | null;
  /** Total count for pagination */
  totalCount: number;
  /** Current page index (0-based) */
  pageIndex: number;
  /** Page size */
  pageSize: number;
  /** Search value */
  searchValue?: string;
  /** Severity filter value */
  severityFilter?: 'all' | GapSeverity;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Callback when page size changes */
  onPageSizeChange: (size: number) => void;
  /** Callback when search changes */
  onSearch?: (term: string) => void;
  /** Callback when severity filter changes */
  onSeverityChange?: (severity: 'all' | GapSeverity) => void;
  /** Callback when sort changes */
  onSortChange?: (sort: SortConfig | null) => void;
  /** Callback when sync is triggered */
  onSync?: (symbol: string, exchange: string) => void;
  /** Callback to retry on error */
  onRetry?: () => void;
  /** Custom class name */
  className?: string;
}

/**
 * Format timestamp to readable date/time
 */
function formatTimestamp(timestamp: number): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format number with thousands separator
 */
function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Severity filter options
 */
const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
];

/**
 * GapTable - Table component for displaying gap data
 */
export function GapTable({
  gaps,
  loading = false,
  error = null,
  totalCount,
  pageIndex,
  pageSize,
  searchValue = '',
  severityFilter = 'all',
  onPageChange,
  onPageSizeChange,
  onSearch,
  onSeverityChange,
  onSortChange,
  onSync,
  onRetry,
  className = '',
}: GapTableProps) {
  // Define columns
  const columns = React.useMemo<ColumnDef<GapRecord, unknown>[]>(
    () => [
      {
        accessorKey: 'symbol',
        header: 'Symbol',
        cell: ({ row }) => (
          <span className="font-medium">{row.original.symbol}</span>
        ),
      },
      {
        accessorKey: 'gapCount',
        header: 'Gap Count',
        cell: ({ row }) => (
          <span
            className={`font-mono ${
              row.original.gapCount >= 10
                ? 'text-red-600 dark:text-red-400'
                : row.original.gapCount >= 3
                ? 'text-yellow-600 dark:text-yellow-400'
                : ''
            }`}
          >
            {formatNumber(row.original.gapCount)}
          </span>
        ),
      },
      {
        accessorKey: 'firstGapTime',
        header: 'First Gap',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatTimestamp(row.original.firstGapTime)}
          </span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'lastGapTime',
        header: 'Last Gap',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatTimestamp(row.original.lastGapTime)}
          </span>
        ),
      },
      {
        accessorKey: 'totalMissingTrades',
        header: 'Missing Trades',
        cell: ({ row }) => (
          <span
            className={`font-mono ${
              row.original.totalMissingTrades >= 10000
                ? 'text-red-600 dark:text-red-400'
                : row.original.totalMissingTrades >= 1000
                ? 'text-yellow-600 dark:text-yellow-400'
                : ''
            }`}
          >
            {formatNumber(row.original.totalMissingTrades)}
          </span>
        ),
      },
      {
        accessorKey: 'severity',
        header: 'Severity',
        cell: ({ row }) => (
          <GapSeverityBadge severity={row.original.severity} />
        ),
        enableSorting: false,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <GapSyncButton
            symbol={row.original.symbol}
            exchange={row.original.exchange}
            onSync={onSync}
          />
        ),
        enableSorting: false,
      },
    ],
    [onSync]
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {onSearch && (
            <SearchInput
              value={searchValue}
              onChange={onSearch}
              placeholder="Search by symbol..."
              className="w-full sm:w-64"
            />
          )}
          {onSeverityChange && (
            <FilterDropdown
              label="Severity"
              value={severityFilter}
              options={SEVERITY_OPTIONS}
              onChange={(value) =>
                onSeverityChange(value as 'all' | GapSeverity)
              }
            />
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {totalCount} {totalCount === 1 ? 'gap' : 'gaps'} found
        </div>
      </div>

      {/* Table */}
      <DataTable
        data={gaps}
        columns={columns}
        loading={loading}
        error={error || undefined}
        sortable
        onSortChange={onSortChange}
        emptyMessage="No gaps found for this exchange"
        onRetry={onRetry}
      />

      {/* Pagination */}
      {totalCount > 0 && (
        <Pagination
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}
