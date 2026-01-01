/**
 * useExchangesPaginated Hook - Exchange list management with pagination
 *
 * Custom hook for fetching and managing exchange list state with pagination,
 * search, and filter support using React Query.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';
import type { Exchange } from '../../domain/types';
import { getExchangesAction } from '../controllers/ExchangeController';

/**
 * Exchange filter options
 */
export interface ExchangeFilters {
  search?: string;
  status?: 'all' | 'enabled' | 'disabled';
}

/**
 * Pagination state
 */
export interface PaginationState {
  pageIndex: number;
  pageSize: number;
}

/**
 * Sort state
 */
export interface SortState {
  column: string;
  order: 'asc' | 'desc';
}

/**
 * Query keys for exchanges
 */
export const exchangeQueryKeys = {
  all: ['exchanges'] as const,
  lists: () => [...exchangeQueryKeys.all, 'list'] as const,
  list: (
    filters: ExchangeFilters,
    pagination: PaginationState,
    sort?: SortState
  ) => [...exchangeQueryKeys.lists(), { filters, pagination, sort }] as const,
};

/**
 * Hook return type
 */
export interface UseExchangesPaginatedReturn {
  /** Exchange list */
  exchanges: Exchange[];
  /** Total count of exchanges */
  totalCount: number;
  /** Whether data is loading */
  isLoading: boolean;
  /** Whether data is being fetched in background */
  isFetching: boolean;
  /** Error message if any */
  error: string | null;
  /** Current pagination state */
  pagination: PaginationState;
  /** Current filters */
  filters: ExchangeFilters;
  /** Current sort state */
  sort: SortState | undefined;
  /** Set page index */
  setPageIndex: (page: number) => void;
  /** Set page size */
  setPageSize: (size: number) => void;
  /** Set search term */
  setSearch: (search: string) => void;
  /** Set status filter */
  setStatusFilter: (status: 'all' | 'enabled' | 'disabled') => void;
  /** Set sort */
  setSort: (sort: SortState | undefined) => void;
  /** Refresh data */
  refresh: () => void;
}

/**
 * Hook for managing exchange list with pagination
 *
 * @param initialPageSize - Initial page size (default: 10)
 * @returns Exchange list state and actions
 */
export function useExchangesPaginated(
  initialPageSize = 10
): UseExchangesPaginatedReturn {
  const queryClient = useQueryClient();

  // Pagination state
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });

  // Filter state
  const [filters, setFilters] = useState<ExchangeFilters>({
    search: '',
    status: 'all',
  });

  // Sort state
  const [sort, setSort] = useState<SortState | undefined>(undefined);

  // Build query request for IPC (pagination params)
  const queryRequest = useMemo(
    () => ({
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      search: filters.search || undefined,
      status: filters.status,
      sortBy: sort?.column as 'name' | 'enabled' | 'healthStatus' | undefined,
      sortOrder: sort?.order,
    }),
    [pagination, filters, sort]
  );

  // Query for exchanges
  const {
    data,
    isLoading,
    isFetching,
    error: queryError,
  } = useQuery({
    queryKey: exchangeQueryKeys.list(filters, pagination, sort),
    queryFn: async () => {
      const result = await getExchangesAction(queryRequest);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch exchanges');
      }
      return result.data!;
    },
    staleTime: 30000, // 30 seconds
  });

  // Handlers
  const setPageIndex = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, pageIndex: page }));
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPagination({ pageIndex: 0, pageSize: size });
  }, []);

  const setSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search }));
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  const setStatusFilter = useCallback(
    (status: 'all' | 'enabled' | 'disabled') => {
      setFilters((prev) => ({ ...prev, status }));
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    },
    []
  );

  const handleSetSort = useCallback((newSort: SortState | undefined) => {
    setSort(newSort);
  }, []);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: exchangeQueryKeys.lists() });
  }, [queryClient]);

  return {
    exchanges: data?.exchanges ?? [],
    totalCount: data?.total ?? 0,
    isLoading,
    isFetching,
    error: queryError instanceof Error ? queryError.message : null,
    pagination,
    filters,
    sort,
    setPageIndex,
    setPageSize,
    setSearch,
    setStatusFilter,
    setSort: handleSetSort,
    refresh,
  };
}
