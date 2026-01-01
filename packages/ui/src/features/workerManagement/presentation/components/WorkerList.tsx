/**
 * WorkerList Component
 *
 * Displays a list of workers using DataTable with search, filter, and pagination.
 * Shows: ID, Status, Assigned Symbols, CPU, Memory, Actions
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

'use client';

import { useMemo, useCallback } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../../../../components/ui/table/DataTable';
import { SearchInput } from '../../../../components/ui/table/SearchInput';
import { FilterDropdown } from '../../../../components/ui/table/FilterDropdown';
import { Pagination } from '../../../../components/ui/table/Pagination';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { WorkerHealthBadge } from './WorkerHealthBadge';
import { useWorkersPaginated } from '../hooks/useWorkersPaginated';
import type { Worker, WorkerState } from '../../domain/types';

/**
 * Status filter options
 */
const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'idle', label: 'Idle' },
  { value: 'error', label: 'Error' },
];

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
 * Format bytes to MB
 */
function formatMemory(bytes: number | undefined): string {
  if (bytes === undefined) return '-';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

/**
 * Format CPU percentage
 */
function formatCpu(percent: number | undefined): string {
  if (percent === undefined) return '-';
  return `${percent.toFixed(1)}%`;
}

/**
 * WorkerList component props
 */
export interface WorkerListProps {
  onSelectWorker?: (workerId: string) => void;
  autoRefreshInterval?: number;
}

/**
 * WorkerList component
 *
 * Displays workers in a DataTable with search, filter, and pagination.
 */
export function WorkerList({
  onSelectWorker,
  autoRefreshInterval = 5000,
}: WorkerListProps) {
  const {
    workers,
    totalCount,
    isLoading,
    isFetching,
    error,
    pagination,
    filters,
    setPageIndex,
    setPageSize,
    setSearch,
    setStatusFilter,
    setSort,
    refresh,
  } = useWorkersPaginated(10, autoRefreshInterval);

  // Handle row click
  const handleRowClick = useCallback(
    (worker: Worker) => {
      onSelectWorker?.(worker.workerId);
    },
    [onSelectWorker]
  );

  // Define columns
  const columns: ColumnDef<Worker, unknown>[] = useMemo(
    () => [
      {
        accessorKey: 'workerId',
        header: 'ID',
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.workerId}</span>
        ),
      },
      {
        accessorKey: 'state',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={getStateBadgeVariant(row.original.state)}>
            {row.original.state}
          </Badge>
        ),
      },
      {
        accessorKey: 'symbolCount',
        header: 'Assigned Symbols',
        cell: ({ row }) => (
          <span className="text-center">{row.original.symbolCount}</span>
        ),
      },
      {
        accessorKey: 'cpuUsage',
        header: 'CPU',
        cell: ({ row }) => {
          const cpuPercent = row.original.healthMetrics?.cpuUsagePercent;
          return (
            <span className="text-center text-muted-foreground">
              {cpuPercent !== undefined && cpuPercent > 0
                ? formatCpu(cpuPercent)
                : 'N/A'}
            </span>
          );
        },
      },
      {
        id: 'memory',
        header: 'Memory',
        cell: ({ row }) => {
          const memoryBytes = row.original.healthMetrics?.memoryUsageBytes;
          return (
            <span className="text-center">
              {memoryBytes !== undefined && memoryBytes > 0
                ? formatMemory(memoryBytes)
                : 'N/A'}
            </span>
          );
        },
      },
      {
        id: 'health',
        header: 'Health',
        cell: ({ row }) => <WorkerHealthBadge worker={row.original} />,
        enableSorting: false,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectWorker?.(row.original.workerId)}
            >
              View
            </Button>
          </div>
        ),
        enableSorting: false,
      },
    ],
    [onSelectWorker]
  );

  // Handle sort change
  const handleSortChange = useCallback(
    (newSort: { column: string; order: 'asc' | 'desc' } | null) => {
      setSort(newSort ?? undefined);
    },
    [setSort]
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">
            Workers
            {totalCount > 0 && (
              <span className="text-muted-foreground ml-2">({totalCount})</span>
            )}
          </CardTitle>
          {isFetching && !isLoading && (
            <span className="text-xs text-muted-foreground">Updating...</span>
          )}
        </div>
        <Button
          onClick={refresh}
          variant="outline"
          size="sm"
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toolbar: Search and Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <SearchInput
            value={filters.search || ''}
            onChange={setSearch}
            placeholder="Search by worker ID..."
            className="w-64"
          />
          <FilterDropdown
            label="Status"
            value={filters.status || 'all'}
            options={STATUS_FILTER_OPTIONS}
            onChange={(value) =>
              setStatusFilter(value as 'all' | 'running' | 'idle' | 'error')
            }
          />
        </div>

        {/* DataTable */}
        <DataTable
          data={workers}
          columns={columns}
          loading={isLoading}
          error={error ?? undefined}
          sortable
          onSortChange={handleSortChange}
          onRowClick={handleRowClick}
          emptyMessage="No workers found. Spawn a new worker to get started."
          onRetry={refresh}
        />

        {/* Pagination */}
        {totalCount > 0 && (
          <Pagination
            pageIndex={pagination.pageIndex}
            pageSize={pagination.pageSize}
            totalCount={totalCount}
            onPageChange={setPageIndex}
            onPageSizeChange={setPageSize}
          />
        )}
      </CardContent>
    </Card>
  );
}
