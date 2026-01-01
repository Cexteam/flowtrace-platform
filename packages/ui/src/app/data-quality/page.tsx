/**
 * Data Quality Page - Refactored
 *
 * Displays data quality information with exchange tabs and gap table.
 * Supports search, filter, pagination, and sorting.
 *
 * Requirements: 9.1 to 11.3
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  GapExchangeSelector,
  GapTable,
  type GapExchangeTabData,
} from '../../features/dataQuality';
import { useGapsByExchange } from '../../features/dataQuality/presentation/hooks/useGapsByExchange';
import { useExchanges } from '../../features/exchangeManagement/presentation/hooks/useExchanges';
import type { SortConfig } from '../../components/ui/table/DataTable';
import type { GapSeverity } from '../../features/dataQuality/domain/types';

export default function DataQualityPage() {
  // Exchange state
  const {
    exchanges,
    loading: exchangesLoading,
    error: exchangesError,
  } = useExchanges(0); // No auto-refresh
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null);

  // Debug logging
  console.log('[DataQualityPage] Render:', {
    exchanges: exchanges.length,
    exchangesLoading,
    exchangesError,
    selectedExchange,
    isElectron: typeof window !== 'undefined' && 'electron' in window,
  });

  // Gap data state
  const {
    gaps,
    totalCount,
    loading: gapsLoading,
    error: gapsError,
    loadGaps,
    refresh,
    currentParams,
  } = useGapsByExchange();

  // Transform exchanges to tab data format
  const exchangeTabData: GapExchangeTabData[] = exchanges.map((exchange) => ({
    name: exchange.name,
    displayName: exchange.displayName,
    isEnabled: exchange.isEnabled,
  }));

  // Handle exchange selection
  const handleExchangeSelect = useCallback(
    (exchangeName: string) => {
      setSelectedExchange(exchangeName);
      loadGaps({
        exchange: exchangeName,
        page: 0,
        pageSize: 25,
        search: '',
        severity: 'all',
        sortBy: 'gapCount',
        sortOrder: 'desc',
      });
    },
    [loadGaps]
  );

  // Handle page change
  const handlePageChange = useCallback(
    (page: number) => {
      if (selectedExchange) {
        loadGaps({ ...currentParams, exchange: selectedExchange, page });
      }
    },
    [selectedExchange, currentParams, loadGaps]
  );

  // Handle page size change
  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      if (selectedExchange) {
        loadGaps({
          ...currentParams,
          exchange: selectedExchange,
          pageSize,
          page: 0,
        });
      }
    },
    [selectedExchange, currentParams, loadGaps]
  );

  // Handle search
  const handleSearch = useCallback(
    (search: string) => {
      if (selectedExchange) {
        loadGaps({
          ...currentParams,
          exchange: selectedExchange,
          search,
          page: 0,
        });
      }
    },
    [selectedExchange, currentParams, loadGaps]
  );

  // Handle severity filter
  const handleSeverityChange = useCallback(
    (severity: 'all' | GapSeverity) => {
      if (selectedExchange) {
        loadGaps({
          ...currentParams,
          exchange: selectedExchange,
          severity,
          page: 0,
        });
      }
    },
    [selectedExchange, currentParams, loadGaps]
  );

  // Handle sort change
  const handleSortChange = useCallback(
    (sort: SortConfig | null) => {
      if (selectedExchange && sort) {
        loadGaps({
          ...currentParams,
          exchange: selectedExchange,
          sortBy: sort.column as
            | 'gapCount'
            | 'totalMissingTrades'
            | 'lastGapTime'
            | 'symbol',
          sortOrder: sort.order,
        });
      }
    },
    [selectedExchange, currentParams, loadGaps]
  );

  // Handle sync (placeholder)
  const handleSync = useCallback((symbol: string, exchange: string) => {
    console.log(`Sync requested for ${symbol} on ${exchange}`);
    // Placeholder - sync functionality to be implemented
  }, []);

  // Auto-select first enabled exchange on load
  useEffect(() => {
    if (!selectedExchange && exchanges.length > 0) {
      const enabledExchange = exchanges.find((e) => e.isEnabled);
      if (enabledExchange) {
        handleExchangeSelect(enabledExchange.name);
      }
    }
  }, [exchanges, selectedExchange, handleExchangeSelect]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold text-foreground">Data Quality</h1>
        <p className="text-muted-foreground mt-1">
          Monitor and manage trade data gaps across exchanges
        </p>
      </header>

      {/* Exchange Selector */}
      <GapExchangeSelector
        exchanges={exchangeTabData}
        selectedExchange={selectedExchange}
        onSelect={handleExchangeSelect}
        loading={exchangesLoading}
      />

      {/* Gap Table */}
      {selectedExchange && (
        <div
          id={`gap-panel-${selectedExchange}`}
          role="tabpanel"
          aria-labelledby={`tab-${selectedExchange}`}
        >
          <GapTable
            gaps={gaps}
            loading={gapsLoading}
            error={gapsError}
            totalCount={totalCount}
            pageIndex={currentParams.page || 0}
            pageSize={currentParams.pageSize || 25}
            searchValue={currentParams.search || ''}
            severityFilter={currentParams.severity || 'all'}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            onSearch={handleSearch}
            onSeverityChange={handleSeverityChange}
            onSortChange={handleSortChange}
            onSync={handleSync}
            onRetry={refresh}
          />
        </div>
      )}

      {/* Empty state when no exchange selected */}
      {!selectedExchange && !exchangesLoading && exchanges.length > 0 && (
        <div className="bg-muted/50 border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">
            Select an exchange to view data quality information
          </p>
        </div>
      )}
    </div>
  );
}
