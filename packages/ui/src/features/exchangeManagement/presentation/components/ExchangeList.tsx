/**
 * ExchangeList Component
 *
 * Displays a list of exchanges using DataTable with search, filter, and pagination.
 * Shows: Name, Status, Health, Symbols Count, Actions
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
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
import { ExchangeHealthBadge } from './ExchangeHealthBadge';
import { ExchangeStatusToggle } from './ExchangeStatusToggle';
import { useExchangesPaginated } from '../hooks/useExchangesPaginated';
import { useExchangeToggle } from '../hooks/useExchangeToggle';
import type { Exchange } from '../../domain/types';

/**
 * Status filter options
 */
const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
];

/**
 * ExchangeList component props
 */
export interface ExchangeListProps {
  onSelectExchange?: (exchangeName: string) => void;
}

/**
 * ExchangeList component
 *
 * Displays exchanges in a DataTable with enable/disable toggles.
 */
export function ExchangeList({ onSelectExchange }: ExchangeListProps) {
  const {
    exchanges,
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
  } = useExchangesPaginated(10);

  const { toggleExchange, togglingExchanges } = useExchangeToggle();

  // Handle toggle
  const handleToggle = useCallback(
    (exchangeName: string, enable: boolean) => {
      toggleExchange({ exchangeName, enable });
    },
    [toggleExchange]
  );

  // Handle row click
  const handleRowClick = useCallback(
    (exchange: Exchange) => {
      onSelectExchange?.(exchange.name);
    },
    [onSelectExchange]
  );

  // Define columns
  const columns: ColumnDef<Exchange, unknown>[] = useMemo(
    () => [
      {
        accessorKey: 'displayName',
        header: 'Name',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.displayName}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.name}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'isEnabled',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.isEnabled ? 'success' : 'secondary'}>
            {row.original.isEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
        ),
      },
      {
        accessorKey: 'healthStatus',
        header: 'Health',
        cell: ({ row }) => (
          <ExchangeHealthBadge health={row.original.healthStatus} />
        ),
      },
      {
        accessorKey: 'symbolCount',
        header: 'Symbols',
        cell: ({ row }) => (
          <span className="text-center">{row.original.symbolCount}</span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <ExchangeStatusToggle
              exchange={row.original}
              onToggle={handleToggle}
              isToggling={togglingExchanges.has(row.original.name)}
            />
          </div>
        ),
        enableSorting: false,
      },
    ],
    [handleToggle, togglingExchanges]
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
            Exchanges
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
            placeholder="Search exchanges..."
            className="w-64"
          />
          <FilterDropdown
            label="Status"
            value={filters.status || 'all'}
            options={STATUS_FILTER_OPTIONS}
            onChange={(value) =>
              setStatusFilter(value as 'all' | 'enabled' | 'disabled')
            }
          />
        </div>

        {/* DataTable */}
        <DataTable
          data={exchanges}
          columns={columns}
          loading={isLoading}
          error={error ?? undefined}
          sortable
          onSortChange={handleSortChange}
          onRowClick={handleRowClick}
          emptyMessage="No exchanges found."
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
