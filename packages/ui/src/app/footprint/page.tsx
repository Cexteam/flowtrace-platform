/**
 * Footprint Page
 *
 * Displays completed candles with footprint data.
 * Integrates FootprintSelector, CandleTable, and CandleDetailPanel.
 *
 * Requirements: 12.1 to 14.3
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import {
  FootprintSelector,
  CandleTable,
  CandleDetailPanel,
  type FootprintExchangeData,
  type FootprintSymbolData,
} from '@/features/footprint/presentation/components';
import { useCompletedCandles } from '@/features/footprint/presentation/hooks/useCompletedCandles';
import { useCandleDetail } from '@/features/footprint/presentation/hooks/useCandleDetail';
import { useExchanges } from '@/features/exchangeManagement/presentation/hooks/useExchanges';
import { useSymbols } from '@/features/symbolManagement/presentation/hooks/useSymbols';
import type { Candle, Timeframe } from '@/features/footprint/domain/types';

export default function FootprintPage() {
  // State for selectors
  const [selectedExchange, setSelectedExchange] = React.useState<string | null>(
    null
  );
  const [selectedSymbol, setSelectedSymbol] = React.useState<string | null>(
    null
  );
  const [selectedTimeframe, setSelectedTimeframe] =
    React.useState<Timeframe>('1m');
  const [startDate, setStartDate] = React.useState<Date | null>(null);
  const [endDate, setEndDate] = React.useState<Date | null>(null);
  const [selectedCandle, setSelectedCandle] = React.useState<Candle | null>(
    null
  );

  // Fetch exchanges
  const { exchanges: rawExchanges, loading: exchangesLoading } =
    useExchanges(0); // Disable auto-refresh

  // Fetch symbols
  const { symbols: rawSymbols, loading: symbolsLoading } = useSymbols(
    undefined,
    0
  ); // Disable auto-refresh

  // Transform exchanges for FootprintSelector
  const exchanges: FootprintExchangeData[] = React.useMemo(
    () =>
      rawExchanges.map((e) => ({
        name: e.name,
        displayName: e.displayName || e.name,
        isEnabled: e.isEnabled,
      })),
    [rawExchanges]
  );

  // Transform symbols for FootprintSelector
  const symbols: FootprintSymbolData[] = React.useMemo(
    () =>
      rawSymbols.map((s) => ({
        symbol: s.symbol,
        exchange: s.exchange,
        isActive: s.status === 'active',
      })),
    [rawSymbols]
  );

  // Calculate start and end times from dates
  const startTime = React.useMemo(
    () => (startDate ? startDate.getTime() : undefined),
    [startDate]
  );
  const endTime = React.useMemo(
    () => (endDate ? endDate.getTime() + 24 * 60 * 60 * 1000 - 1 : undefined), // End of day
    [endDate]
  );

  // Fetch completed candles
  const {
    candles,
    totalCount,
    loading: candlesLoading,
    error: candlesError,
    currentParams,
    loadCandles,
    setPage,
    setPageSize,
    refresh: refreshCandles,
  } = useCompletedCandles();

  // Fetch candle detail
  const {
    candleDetail,
    loading: detailLoading,
    error: detailError,
    loadCandleDetail,
    clearCandleDetail,
  } = useCandleDetail();

  // Load candles when selection changes
  React.useEffect(() => {
    if (selectedExchange && selectedSymbol && selectedTimeframe) {
      loadCandles({
        exchange: selectedExchange,
        symbol: selectedSymbol,
        timeframe: selectedTimeframe,
        page: 0,
        pageSize: 25,
        startTime,
        endTime,
        sortOrder: 'desc', // Default: newest first
      });
    }
  }, [
    selectedExchange,
    selectedSymbol,
    selectedTimeframe,
    startTime,
    endTime,
    loadCandles,
  ]);

  // Handle exchange change
  const handleExchangeChange = React.useCallback(
    (exchange: string | null) => {
      setSelectedExchange(exchange);
      setSelectedSymbol(null);
      setSelectedCandle(null);
      clearCandleDetail();
    },
    [clearCandleDetail]
  );

  // Handle symbol change
  const handleSymbolChange = React.useCallback(
    (symbol: string | null) => {
      setSelectedSymbol(symbol);
      setSelectedCandle(null);
      clearCandleDetail();
    },
    [clearCandleDetail]
  );

  // Handle timeframe change
  const handleTimeframeChange = React.useCallback(
    (timeframe: Timeframe) => {
      setSelectedTimeframe(timeframe);
      setSelectedCandle(null);
      clearCandleDetail();
    },
    [clearCandleDetail]
  );

  // Handle row click
  const handleRowClick = React.useCallback(
    (candle: Candle) => {
      setSelectedCandle(candle);
      loadCandleDetail({
        exchange: candle.exchange,
        symbol: candle.symbol,
        timeframe: candle.timeframe,
        openTime: candle.openTime,
      });
    },
    [loadCandleDetail]
  );

  // Handle close detail panel
  const handleCloseDetail = React.useCallback(() => {
    setSelectedCandle(null);
    clearCandleDetail();
  }, [clearCandleDetail]);

  // Check if we can show the table
  const canShowTable = selectedExchange && selectedSymbol && selectedTimeframe;

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Footprint</h1>
            <p className="text-muted-foreground mt-1">
              Order flow and volume profile analysis
            </p>
          </div>
          <Link href="/" className="text-primary hover:underline">
            ← Back to Home
          </Link>
        </header>

        {/* Selectors */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <FootprintSelector
              exchanges={exchanges}
              symbols={symbols}
              selectedExchange={selectedExchange}
              selectedSymbol={selectedSymbol}
              selectedTimeframe={selectedTimeframe}
              startDate={startDate}
              endDate={endDate}
              onExchangeChange={handleExchangeChange}
              onSymbolChange={handleSymbolChange}
              onTimeframeChange={handleTimeframeChange}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              exchangesLoading={exchangesLoading}
              symbolsLoading={symbolsLoading}
            />
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Candle Table */}
          <div className={selectedCandle ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <Card>
              <CardHeader>
                <CardTitle>
                  {canShowTable
                    ? `${selectedSymbol} - ${selectedTimeframe} Candles`
                    : 'Candles'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!canShowTable ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <svg
                      className="h-12 w-12 mx-auto mb-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    <p>
                      Select an exchange, symbol, and timeframe to view candles
                    </p>
                  </div>
                ) : (
                  <CandleTable
                    candles={candles}
                    totalCount={totalCount}
                    pageIndex={currentParams.page || 0}
                    pageSize={currentParams.pageSize || 25}
                    loading={candlesLoading}
                    error={candlesError}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    onRowClick={handleRowClick}
                    onRetry={refreshCandles}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Candle Detail Panel */}
          {selectedCandle && (
            <div className="lg:col-span-1">
              <CandleDetailPanel
                candleDetail={candleDetail}
                loading={detailLoading}
                error={detailError}
                onClose={handleCloseDetail}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
