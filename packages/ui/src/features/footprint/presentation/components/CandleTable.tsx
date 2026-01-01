/**
 * CandleTable Component
 *
 * Displays completed candles in a DataTable with columns for OHLCV data.
 * Supports search, filter, pagination, and sorting.
 * Default sort by time (newest first).
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

'use client';

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/table/DataTable';
import { Pagination } from '@/components/ui/table/Pagination';
import { SearchInput } from '@/components/ui/table/SearchInput';
import type { Candle } from '../../domain/types';

export interface CandleTableProps {
  /** List of candles to display */
  candles: Candle[];
  /** Total count for pagination */
  totalCount: number;
  /** Current page index (0-based) */
  pageIndex: number;
  /** Page size */
  pageSize: number;
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string | null;
  /** Search value */
  searchValue?: string;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Callback when page size changes */
  onPageSizeChange: (size: number) => void;
  /** Callback when search changes */
  onSearch?: (term: string) => void;
  /** Callback when sort changes */
  onSortChange?: (column: string, order: 'asc' | 'desc') => void;
  /** Callback when a row is clicked */
  onRowClick?: (candle: Candle) => void;
  /** Callback for retry on error */
  onRetry?: () => void;
  /** Custom class name */
  className?: string;
}

/**
 * Format timestamp to readable date/time
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Format number with appropriate precision
 */
function formatPrice(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  });
}

/**
 * Format volume with K/M suffix
 */
function formatVolume(volume: number): string {
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`;
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(2)}K`;
  }
  return volume.toFixed(2);
}

/**
 * CandleTable - Table component for displaying candle data
 */
export function CandleTable({
  candles,
  totalCount,
  pageIndex,
  pageSize,
  loading = false,
  error = null,
  searchValue = '',
  onPageChange,
  onPageSizeChange,
  onSearch,
  onSortChange,
  onRowClick,
  onRetry,
  className = '',
}: CandleTableProps) {
  // Define columns for the table
  const columns: ColumnDef<Candle, unknown>[] = React.useMemo(
    () => [
      {
        accessorKey: 'openTime',
        header: 'Open Time',
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {formatTime(row.original.openTime)}
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'closeTime',
        header: 'Close Time',
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {formatTime(row.original.closeTime)}
          </span>
        ),
        enableSorting: true,
      },
      {
        id: 'ohlc',
        header: 'O/H/L/C',
        cell: ({ row }) => {
          const { open, high, low, close } = row.original;
          const isGreen = close >= open;
          return (
            <div className="font-mono text-sm">
              <span className="text-muted-foreground">{formatPrice(open)}</span>
              <span className="mx-1">/</span>
              <span className="text-green-500">{formatPrice(high)}</span>
              <span className="mx-1">/</span>
              <span className="text-red-500">{formatPrice(low)}</span>
              <span className="mx-1">/</span>
              <span className={isGreen ? 'text-green-500' : 'text-red-500'}>
                {formatPrice(close)}
              </span>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'volume',
        header: 'Volume',
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {formatVolume(row.original.volume)}
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'buyVolume',
        header: 'Buy Vol',
        cell: ({ row }) => (
          <span className="font-mono text-sm text-green-500">
            {formatVolume(row.original.buyVolume)}
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'sellVolume',
        header: 'Sell Vol',
        cell: ({ row }) => (
          <span className="font-mono text-sm text-red-500">
            {formatVolume(row.original.sellVolume)}
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'delta',
        header: 'Delta',
        cell: ({ row }) => {
          const delta = row.original.delta;
          const isPositive = delta >= 0;
          return (
            <span
              className={`font-mono text-sm ${
                isPositive ? 'text-green-500' : 'text-red-500'
              }`}
            >
              {isPositive ? '+' : ''}
              {formatVolume(delta)}
            </span>
          );
        },
        enableSorting: true,
      },
    ],
    []
  );

  // Handle sort change
  const handleSortChange = React.useCallback(
    (sort: { column: string; order: 'asc' | 'desc' } | null) => {
      if (sort && onSortChange) {
        onSortChange(sort.column, sort.order);
      }
    },
    [onSortChange]
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Input */}
      {onSearch && (
        <div className="flex items-center gap-4">
          <SearchInput
            value={searchValue}
            onChange={onSearch}
            placeholder="Search by timestamp..."
            className="w-64"
          />
        </div>
      )}

      {/* Data Table */}
      <DataTable
        data={candles}
        columns={columns}
        loading={loading}
        error={error || undefined}
        sortable={true}
        onSortChange={handleSortChange}
        onRowClick={onRowClick}
        emptyMessage="No candles found for the selected criteria"
        onRetry={onRetry}
        pagination={{
          pageIndex,
          pageSize,
          totalCount,
          onPageChange,
          onPageSizeChange,
        }}
      />

      {/* Pagination */}
      {!loading && !error && candles.length > 0 && (
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
