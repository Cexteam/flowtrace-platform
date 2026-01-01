/**
 * SymbolTable Component
 *
 * Displays symbols in a DataTable with columns:
 * Symbol, Base/Quote, Status, Admin Enabled, Pipeline Status, Actions
 *
 * Integrates search, filter, pagination, and sorting.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

'use client';

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import {
  DataTable,
  SearchInput,
  FilterDropdown,
  Pagination,
} from '../../../../components/ui/table';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { getPipelineStatus } from '../../../../lib/utils/pipeline';
import type { Symbol, SymbolStatus } from '../../domain/types';

/**
 * Symbol filters state
 */
export interface SymbolFilters {
  search: string;
  status: 'all' | 'active' | 'inactive' | 'delisted' | 'pending_review';
  enabledByAdmin: 'all' | 'enabled' | 'disabled';
}

/**
 * Symbol pagination state
 */
export interface SymbolPagination {
  pageIndex: number;
  pageSize: number;
  totalCount: number;
}

export interface SymbolTableProps {
  /** Symbols to display */
  symbols: Symbol[];
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string;
  /** Current filters */
  filters: SymbolFilters;
  /** Callback when filters change */
  onFiltersChange: (filters: SymbolFilters) => void;
  /** Pagination state */
  pagination: SymbolPagination;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Callback when page size changes */
  onPageSizeChange: (size: number) => void;
  /** Callback when sort changes */
  onSortChange?: (
    sort: { column: string; order: 'asc' | 'desc' } | null
  ) => void;
  /** Callback when status toggle is clicked */
  onToggleStatus?: (symbolId: string, currentStatus: SymbolStatus) => void;
  /** Callback when admin enabled toggle is clicked */
  onToggleAdminEnabled?: (symbolId: string, currentEnabled: boolean) => void;
  /** Callback when row is clicked */
  onRowClick?: (symbol: Symbol) => void;
  /** Callback when retry is clicked */
  onRetry?: () => void;
  /** IDs of symbols currently being toggled */
  togglingSymbolIds?: Set<string>;
}

/**
 * Status filter options - matches database statuses
 */
const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'delisted', label: 'Delisted' },
  { value: 'pending_review', label: 'Pending Review' },
];

/**
 * Admin enabled filter options
 */
const ADMIN_ENABLED_OPTIONS = [
  { value: 'all', label: 'All Admin' },
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
];

/**
 * Get status badge variant
 */
function getStatusBadgeVariant(
  status: SymbolStatus
): 'success' | 'secondary' | 'destructive' | 'warning' {
  switch (status) {
    case 'active':
      return 'success';
    case 'inactive':
      return 'secondary';
    case 'delisted':
      return 'destructive';
    case 'pending_review':
      return 'warning';
    default:
      return 'secondary';
  }
}

/**
 * Get pipeline status badge variant
 */
function getPipelineStatusBadgeVariant(
  status: 'Running' | 'Stopped'
): 'success' | 'secondary' {
  return status === 'Running' ? 'success' : 'secondary';
}

/**
 * SymbolTable - DataTable-based symbol list
 */
export function SymbolTable({
  symbols,
  loading = false,
  error,
  filters,
  onFiltersChange,
  pagination,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onToggleStatus,
  onToggleAdminEnabled,
  onRowClick,
  onRetry,
  togglingSymbolIds = new Set(),
}: SymbolTableProps) {
  // Define columns
  const columns = React.useMemo<ColumnDef<Symbol, unknown>[]>(
    () => [
      {
        accessorKey: 'symbol',
        header: 'Symbol',
        cell: ({ row }) => (
          <span className="font-mono font-medium">{row.original.symbol}</span>
        ),
      },
      {
        id: 'baseQuote',
        header: 'Base/Quote',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.baseAsset}/{row.original.quoteAsset}
          </span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={getStatusBadgeVariant(row.original.status)}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'enabledByAdmin',
        header: 'Admin Enabled',
        cell: ({ row }) => (
          <Badge
            variant={row.original.enabledByAdmin ? 'success' : 'secondary'}
          >
            {row.original.enabledByAdmin ? 'Enabled' : 'Disabled'}
          </Badge>
        ),
      },
      {
        id: 'pipelineStatus',
        header: 'Pipeline',
        cell: ({ row }) => {
          const pipelineStatus = getPipelineStatus({
            status: row.original.status,
            enabledByAdmin: row.original.enabledByAdmin,
          });
          return (
            <Badge variant={getPipelineStatusBadgeVariant(pipelineStatus)}>
              {pipelineStatus}
            </Badge>
          );
        },
        enableSorting: false,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const symbol = row.original;
          const isToggling = togglingSymbolIds.has(symbol.id);
          // Can only activate if admin enabled and not delisted
          const canActivate =
            symbol.enabledByAdmin && symbol.status !== 'delisted';
          const canDeactivate = symbol.status === 'active';

          return (
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Status Toggle: Activate/Deactivate */}
              <Button
                variant={symbol.status === 'active' ? 'destructive' : 'default'}
                size="sm"
                disabled={isToggling || (!canActivate && !canDeactivate)}
                onClick={() => {
                  console.log(
                    '[SymbolTable] Toggle status clicked:',
                    symbol.id,
                    symbol.status,
                    'canActivate:',
                    canActivate
                  );
                  onToggleStatus?.(symbol.id, symbol.status);
                }}
                title={
                  symbol.status === 'active'
                    ? 'Stop streaming'
                    : !symbol.enabledByAdmin
                    ? 'Enable by admin first to activate'
                    : symbol.status === 'delisted'
                    ? 'Cannot activate delisted symbol'
                    : 'Start streaming'
                }
              >
                {isToggling ? (
                  <span className="animate-spin">⟳</span>
                ) : symbol.status === 'active' ? (
                  '⏹ Stop'
                ) : (
                  '▶ Start'
                )}
              </Button>
              {/* Admin Toggle: Enable/Disable by Admin */}
              <Button
                variant={symbol.enabledByAdmin ? 'outline' : 'secondary'}
                size="sm"
                disabled={isToggling}
                onClick={() => {
                  console.log(
                    '[SymbolTable] Toggle admin clicked:',
                    symbol.id,
                    symbol.enabledByAdmin
                  );
                  onToggleAdminEnabled?.(symbol.id, symbol.enabledByAdmin);
                }}
                title={
                  symbol.enabledByAdmin
                    ? 'Lock (prevent activation)'
                    : 'Unlock (allow activation)'
                }
              >
                {isToggling ? (
                  <span className="animate-spin">⟳</span>
                ) : symbol.enabledByAdmin ? (
                  '🔒 Lock'
                ) : (
                  '🔓 Unlock'
                )}
              </Button>
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [onToggleStatus, onToggleAdminEnabled, togglingSymbolIds]
  );

  // Handle search change
  const handleSearchChange = React.useCallback(
    (value: string) => {
      onFiltersChange({ ...filters, search: value });
    },
    [filters, onFiltersChange]
  );

  // Handle status filter change
  const handleStatusChange = React.useCallback(
    (value: string) => {
      onFiltersChange({
        ...filters,
        status: value as SymbolFilters['status'],
      });
    },
    [filters, onFiltersChange]
  );

  // Handle admin enabled filter change
  const handleAdminEnabledChange = React.useCallback(
    (value: string) => {
      onFiltersChange({
        ...filters,
        enabledByAdmin: value as SymbolFilters['enabledByAdmin'],
      });
    },
    [filters, onFiltersChange]
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4">
        <SearchInput
          value={filters.search}
          onChange={handleSearchChange}
          placeholder="Search symbols..."
          className="w-64"
        />
        <FilterDropdown
          label="Status"
          value={filters.status}
          options={STATUS_OPTIONS}
          onChange={handleStatusChange}
        />
        <FilterDropdown
          label="Admin"
          value={filters.enabledByAdmin}
          options={ADMIN_ENABLED_OPTIONS}
          onChange={handleAdminEnabledChange}
        />
      </div>

      {/* Table */}
      <DataTable
        data={symbols}
        columns={columns}
        loading={loading}
        error={error}
        pagination={{
          pageIndex: pagination.pageIndex,
          pageSize: pagination.pageSize,
          totalCount: pagination.totalCount,
          onPageChange,
          onPageSizeChange,
        }}
        sortable
        onSortChange={onSortChange}
        onRowClick={onRowClick}
        onRetry={onRetry}
        emptyMessage="No symbols found. Try adjusting your filters."
      />

      {/* Pagination */}
      {!loading && !error && symbols.length > 0 && (
        <Pagination
          pageIndex={pagination.pageIndex}
          pageSize={pagination.pageSize}
          totalCount={pagination.totalCount}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}
