/**
 * useSymbolsPaginated Hook - Paginated Symbol list management
 *
 * Custom hook for fetching and managing paginated symbol list state.
 * Uses React Query with proper cache keys for pagination, search, and filters.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { Symbol, SymbolStatus } from '../../domain/types';
import { getSymbolsAction } from '../controllers/SymbolController';

/**
 * Symbol filters for the paginated hook
 */
export interface SymbolFiltersState {
  search: string;
  status: 'all' | 'active' | 'inactive' | 'delisted' | 'pending_review';
  enabledByAdmin: 'all' | 'enabled' | 'disabled';
}

/**
 * Symbol pagination state
 */
export interface SymbolPaginationState {
  pageIndex: number;
  pageSize: number;
}

/**
 * Symbol sort state
 */
export interface SymbolSortState {
  column: 'symbol' | 'createdAt' | 'updatedAt';
  order: 'asc' | 'desc';
}

/**
 * Query key factory for symbols
 */
export const symbolQueryKeys = {
  all: ['symbols'] as const,
  lists: () => [...symbolQueryKeys.all, 'list'] as const,
  list: (
    exchange: string,
    filters: SymbolFiltersState,
    pagination: SymbolPaginationState,
    sort?: SymbolSortState
  ) =>
    [...symbolQueryKeys.lists(), exchange, filters, pagination, sort] as const,
  details: () => [...symbolQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...symbolQueryKeys.details(), id] as const,
};

/**
 * Hook options
 */
export interface UseSymbolsPaginatedOptions {
  /** Exchange to filter by */
  exchange: string;
  /** Current filters */
  filters: SymbolFiltersState;
  /** Current pagination */
  pagination: SymbolPaginationState;
  /** Current sort */
  sort?: SymbolSortState;
  /** Whether to enable the query */
  enabled?: boolean;
}

/**
 * Hook return type
 */
export interface UseSymbolsPaginatedReturn {
  /** Symbols data */
  symbols: Symbol[];
  /** Total count of symbols */
  totalCount: number;
  /** Total pages */
  totalPages: number;
  /** Loading state */
  isLoading: boolean;
  /** Fetching state (for background refetch) */
  isFetching: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch function */
  refetch: () => void;
  /** Invalidate and refetch */
  invalidate: () => void;
}

/**
 * Hook for managing paginated symbol list with React Query
 *
 * @param options - Hook options including exchange, filters, pagination, and sort
 * @returns Paginated symbol list state and actions
 */
export function useSymbolsPaginated({
  exchange,
  filters,
  pagination,
  sort,
  enabled = true,
}: UseSymbolsPaginatedOptions): UseSymbolsPaginatedReturn {
  const queryClient = useQueryClient();

  // Build query key
  const queryKey = useMemo(
    () => symbolQueryKeys.list(exchange, filters, pagination, sort),
    [exchange, filters, pagination, sort]
  );

  // Build request params
  const requestParams = useMemo(() => {
    const params: Record<string, unknown> = {
      exchange,
      page: pagination.pageIndex + 1, // API uses 1-based pagination
      pageSize: pagination.pageSize,
    };

    console.log('[useSymbolsPaginated] Building request params:', {
      exchange,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    });

    // Add search filter
    if (filters.search) {
      params.search = filters.search;
    }

    // Add status filter
    if (filters.status !== 'all') {
      params.status = filters.status as SymbolStatus;
      console.log(
        '[useSymbolsPaginated] Adding status filter:',
        filters.status
      );
    }

    // Add enabledByAdmin filter - send as string for IPC handler
    if (filters.enabledByAdmin !== 'all') {
      params.enabledByAdmin = filters.enabledByAdmin; // 'enabled' or 'disabled'
      console.log(
        '[useSymbolsPaginated] Adding enabledByAdmin filter:',
        params.enabledByAdmin
      );
    }

    // Add sort
    if (sort) {
      params.sortBy = sort.column;
      params.sortOrder = sort.order;
    }

    return params;
  }, [exchange, filters, pagination, sort]);

  // Query
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await getSymbolsAction(requestParams);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch symbols');
      }
      // Handle both legacy (total) and new pagination format (pagination.totalCount)
      const responseData = result.data!;
      const total =
        'pagination' in responseData
          ? (responseData as { pagination: { totalCount: number } }).pagination
              .totalCount
          : (responseData as { total: number }).total;
      return {
        symbols: responseData.symbols,
        total,
      };
    },
    enabled: enabled && !!exchange,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
  });

  // Invalidate function
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: symbolQueryKeys.lists() });
  }, [queryClient]);

  // Calculate total pages
  const totalPages = useMemo(() => {
    if (!data) return 0;
    return Math.ceil(data.total / pagination.pageSize);
  }, [data, pagination.pageSize]);

  return {
    symbols: data?.symbols ?? [],
    totalCount: data?.total ?? 0,
    totalPages,
    isLoading,
    isFetching,
    error: error as Error | null,
    refetch,
    invalidate,
  };
}

/**
 * Hook for prefetching the next page of symbols
 */
export function usePrefetchSymbols() {
  const queryClient = useQueryClient();

  return useCallback(
    async (
      exchange: string,
      filters: SymbolFiltersState,
      pagination: SymbolPaginationState,
      sort?: SymbolSortState
    ) => {
      const nextPagination = {
        ...pagination,
        pageIndex: pagination.pageIndex + 1,
      };

      const queryKey = symbolQueryKeys.list(
        exchange,
        filters,
        nextPagination,
        sort
      );

      await queryClient.prefetchQuery({
        queryKey,
        queryFn: async () => {
          const params: Record<string, unknown> = {
            exchange,
            page: nextPagination.pageIndex + 1, // API uses 1-based pagination
            pageSize: nextPagination.pageSize,
          };

          if (filters.search) {
            params.search = filters.search;
          }

          if (filters.status !== 'all') {
            params.status = filters.status;
          }

          if (filters.enabledByAdmin !== 'all') {
            params.enabledByAdmin = filters.enabledByAdmin === 'enabled';
          }

          if (sort) {
            params.sortBy = sort.column;
            params.sortOrder = sort.order;
          }

          const result = await getSymbolsAction(params);
          if (!result.success) {
            throw new Error(result.error || 'Failed to fetch symbols');
          }
          return result.data!;
        },
        staleTime: 30000,
      });
    },
    [queryClient]
  );
}
