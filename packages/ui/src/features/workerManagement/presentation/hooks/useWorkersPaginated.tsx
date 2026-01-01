/**
 * useWorkersPaginated Hook - Paginated worker list management
 *
 * Custom hook for fetching and managing paginated worker list state.
 * Supports search, filter, pagination, and sorting.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 * Requirements: 17.3 - Auto-refresh worker statistics periodically
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Worker, WorkerFilters } from '../../domain/types';
import { getWorkersAction } from '../controllers/WorkerController';

interface PaginationState {
  pageIndex: number;
  pageSize: number;
}

interface SortState {
  column: string;
  order: 'asc' | 'desc';
}

interface UseWorkersPaginatedReturn {
  workers: Worker[];
  totalCount: number;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  pagination: PaginationState;
  filters: WorkerFilters;
  setPageIndex: (page: number) => void;
  setPageSize: (size: number) => void;
  setSearch: (search: string) => void;
  setStatusFilter: (status: 'all' | 'running' | 'idle' | 'error') => void;
  setSort: (sort: SortState | undefined) => void;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing paginated worker list
 *
 * @param initialPageSize - Initial page size (default: 10)
 * @param autoRefreshInterval - Optional interval in ms for auto-refresh (default: 5000)
 * @returns Paginated worker list state and actions
 */
export function useWorkersPaginated(
  initialPageSize = 10,
  autoRefreshInterval = 5000
): UseWorkersPaginatedReturn {
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });

  const [filters, setFilters] = useState<WorkerFilters>({
    search: '',
    status: 'all',
  });

  const [sort, setSort] = useState<SortState | undefined>(undefined);

  const isInitialLoad = useRef(true);

  // Fetch workers from API
  const fetchWorkers = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setIsLoading(true);
    } else {
      setIsFetching(true);
    }
    setError(null);

    try {
      const result = await getWorkersAction();

      if (result.success && result.data) {
        setAllWorkers(result.data.workers);
      } else {
        setError(result.error || 'Failed to load workers');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      fetchWorkers(true);
    }
  }, [fetchWorkers]);

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    const intervalId = setInterval(() => {
      fetchWorkers(false);
    }, autoRefreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefreshInterval, fetchWorkers]);

  // Apply filters, sorting, and pagination client-side
  const filteredWorkers = useCallback(() => {
    let result = [...allWorkers];

    // Apply search filter (case-insensitive search by worker ID)
    if (filters.search) {
      const searchTerm = filters.search.trim().toLowerCase();
      result = result.filter((worker) =>
        worker.workerId.toLowerCase().includes(searchTerm)
      );
    }

    // Apply status filter
    if (filters.status && filters.status !== 'all') {
      result = result.filter((worker) => worker.state === filters.status);
    }

    // Apply sorting
    if (sort) {
      result.sort((a, b) => {
        let aVal: unknown = a[sort.column as keyof Worker];
        let bVal: unknown = b[sort.column as keyof Worker];

        // Handle nested properties
        if (sort.column === 'memory') {
          aVal = a.healthMetrics?.memoryUsageBytes ?? 0;
          bVal = b.healthMetrics?.memoryUsageBytes ?? 0;
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sort.order === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sort.order === 'asc' ? aVal - bVal : bVal - aVal;
        }

        return 0;
      });
    }

    return result;
  }, [allWorkers, filters, sort]);

  // Get paginated data
  const paginatedData = useCallback(() => {
    const filtered = filteredWorkers();
    const start = pagination.pageIndex * pagination.pageSize;
    const end = start + pagination.pageSize;
    return filtered.slice(start, end);
  }, [filteredWorkers, pagination]);

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
    (status: 'all' | 'running' | 'idle' | 'error') => {
      setFilters((prev) => ({ ...prev, status }));
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    },
    []
  );

  const handleSetSort = useCallback((newSort: SortState | undefined) => {
    setSort(newSort);
  }, []);

  const refresh = useCallback(async () => {
    await fetchWorkers(true);
  }, [fetchWorkers]);

  const filtered = filteredWorkers();

  return {
    workers: paginatedData(),
    totalCount: filtered.length,
    isLoading,
    isFetching,
    error,
    pagination,
    filters,
    setPageIndex,
    setPageSize,
    setSearch,
    setStatusFilter,
    setSort: handleSetSort,
    refresh,
  };
}
