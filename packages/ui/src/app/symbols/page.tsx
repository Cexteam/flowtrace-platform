'use client';

/**
 * Symbols Page - Refactored
 *
 * Symbol Management page with:
 * - Exchange selector tabs (only enabled exchanges)
 * - Symbol table with DataTable
 * - Search, filter, pagination, sorting
 * - Status and admin enabled toggles
 *
 * Requirements: 1.1 to 3.6
 */

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  ExchangeSelector,
  SymbolTable,
  type ExchangeTabData,
  type SymbolFilters,
} from '@/features/symbolManagement';
import {
  useSymbolsPaginated,
  useToggleSymbol,
  type SymbolFiltersState,
  type SymbolSortState,
} from '@/features/symbolManagement/presentation/hooks';
import { useExchanges } from '@/features/exchangeManagement/presentation/hooks';
import type { Symbol } from '@/features/symbolManagement/domain/types';

export default function SymbolsPage() {
  // Exchange state
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null);

  // Filters state
  const [filters, setFilters] = useState<SymbolFiltersState>({
    search: '',
    status: 'all',
    enabledByAdmin: 'all',
  });

  // Pagination state
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 25,
  });

  // Sort state
  const [sort, setSort] = useState<SymbolSortState | undefined>(undefined);

  // Fetch exchanges
  const {
    exchanges,
    loading: exchangesLoading,
    error: exchangesError,
    refresh: refreshExchanges,
  } = useExchanges();

  // Transform exchanges to ExchangeTabData format
  const exchangeTabData: ExchangeTabData[] = useMemo(() => {
    console.log('[SymbolsPage] Raw exchanges from hook:', exchanges);
    const tabData = exchanges.map((exchange) => ({
      name: exchange.name,
      displayName: exchange.displayName,
      isEnabled: exchange.isEnabled,
      symbolCount: exchange.symbolCount,
      activeSymbolCount: exchange.symbolCount, // TODO: Get actual active count from API
    }));
    console.log('[SymbolsPage] Transformed exchangeTabData:', tabData);
    console.log(
      '[SymbolsPage] Enabled exchanges:',
      tabData.filter((e) => e.isEnabled)
    );
    return tabData;
  }, [exchanges]);

  // Fetch symbols with pagination
  const {
    symbols,
    totalCount,
    isLoading: symbolsLoading,
    isFetching: symbolsFetching,
    error: symbolsError,
    refetch: refetchSymbols,
  } = useSymbolsPaginated({
    exchange: selectedExchange || '',
    filters,
    pagination,
    sort,
    enabled: !!selectedExchange,
  });

  // Toggle mutations
  const {
    toggleStatus,
    toggleAdminEnabled,
    confirmPendingAction,
    cancelPendingAction,
    togglingSymbolIds,
    confirmDialog,
  } = useToggleSymbol();

  // Handle exchange selection
  const handleExchangeSelect = useCallback((exchangeName: string) => {
    setSelectedExchange(exchangeName);
    // Reset pagination when exchange changes
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  // Handle filters change
  const handleFiltersChange = useCallback((newFilters: SymbolFilters) => {
    setFilters(newFilters);
    // Reset pagination when filters change
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, pageIndex: page }));
  }, []);

  // Handle page size change
  const handlePageSizeChange = useCallback((size: number) => {
    console.log('[SymbolsPage] handlePageSizeChange called with size:', size);
    setPagination({ pageIndex: 0, pageSize: size });
  }, []);

  // Handle sort change
  const handleSortChange = useCallback(
    (newSort: { column: string; order: 'asc' | 'desc' } | null) => {
      if (newSort) {
        setSort({
          column: newSort.column as SymbolSortState['column'],
          order: newSort.order,
        });
      } else {
        setSort(undefined);
      }
    },
    []
  );

  // Handle status toggle
  const handleToggleStatus = useCallback(
    (symbolId: string, currentStatus: string) => {
      const symbol = symbols.find((s) => s.id === symbolId);
      toggleStatus({ symbolId, currentStatus, symbol });
    },
    [toggleStatus, symbols]
  );

  // Handle admin enabled toggle
  const handleToggleAdminEnabled = useCallback(
    (symbolId: string, currentEnabled: boolean) => {
      const symbol = symbols.find((s) => s.id === symbolId);
      toggleAdminEnabled({ symbolId, currentEnabled, symbol });
    },
    [toggleAdminEnabled, symbols]
  );

  // Handle row click
  const handleRowClick = useCallback((symbol: Symbol) => {
    // TODO: Navigate to symbol detail or show detail panel
    console.log('Symbol clicked:', symbol);
  }, []);

  // Handle retry
  const handleRetry = useCallback(() => {
    if (exchangesError) {
      refreshExchanges();
    }
    if (symbolsError) {
      refetchSymbols();
    }
  }, [exchangesError, symbolsError, refreshExchanges, refetchSymbols]);

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Symbols</h1>
            <p className="text-muted-foreground mt-1">
              Manage trading symbols by exchange
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => {
                refreshExchanges();
                refetchSymbols();
              }}
              disabled={exchangesLoading || symbolsFetching}
            >
              {symbolsFetching ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Link href="/" className="text-primary hover:underline">
              ← Back to Home
            </Link>
          </div>
        </header>

        {/* Exchange Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Select Exchange</CardTitle>
          </CardHeader>
          <CardContent>
            {exchangesError ? (
              <div className="text-center py-4">
                <p className="text-destructive mb-4">
                  Failed to load exchanges: {exchangesError}
                </p>
                <Button onClick={refreshExchanges} variant="outline">
                  Retry
                </Button>
              </div>
            ) : (
              <ExchangeSelector
                exchanges={exchangeTabData}
                selectedExchange={selectedExchange}
                onSelect={handleExchangeSelect}
                showSymbolCount
                loading={exchangesLoading}
              />
            )}
          </CardContent>
        </Card>

        {/* Symbol Table */}
        {selectedExchange && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Symbols - {selectedExchange}
                {totalCount > 0 && (
                  <span className="text-muted-foreground font-normal ml-2">
                    ({totalCount} total)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SymbolTable
                symbols={symbols}
                loading={symbolsLoading}
                error={symbolsError?.message}
                filters={filters}
                onFiltersChange={handleFiltersChange}
                pagination={{
                  pageIndex: pagination.pageIndex,
                  pageSize: pagination.pageSize,
                  totalCount,
                }}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                onSortChange={handleSortChange}
                onToggleStatus={handleToggleStatus}
                onToggleAdminEnabled={handleToggleAdminEnabled}
                onRowClick={handleRowClick}
                onRetry={handleRetry}
                togglingSymbolIds={togglingSymbolIds}
              />
            </CardContent>
          </Card>
        )}

        {/* Confirmation Dialog for all actions */}
        <ConfirmDialog
          open={confirmDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              cancelPendingAction();
            }
          }}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmLabel={confirmDialog.confirmLabel}
          cancelLabel="Cancel"
          onConfirm={confirmPendingAction}
          onCancel={cancelPendingAction}
          variant={confirmDialog.variant}
        />
      </div>
    </main>
  );
}
