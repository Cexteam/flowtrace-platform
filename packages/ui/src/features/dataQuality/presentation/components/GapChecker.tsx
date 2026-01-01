/**
 * GapChecker Component
 *
 * Form component for selecting symbol, exchange, and date range to check trade gaps.
 * Shows loading state during check.
 *
 * @requirements 3.3 - Presentation layer with components, hooks, and pages
 * @requirements 8.5 - Loading state during check
 */

'use client';

import { useState, useCallback, FormEvent } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import type { CheckTradeGapsRequest } from '../../domain/types';

/**
 * GapChecker component props
 */
interface GapCheckerProps {
  /** Available exchanges to select from */
  exchanges?: string[];
  /** Available symbols to select from (filtered by exchange) */
  symbols?: Array<{ id: string; symbol: string; exchange: string }>;
  /** Loading state */
  loading?: boolean;
  /** Callback when check is triggered */
  onCheck: (request: CheckTradeGapsRequest) => void;
}

/**
 * Get default date range (last 24 hours)
 */
function getDefaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return {
    from: formatDate(yesterday),
    to: formatDate(now),
  };
}

/**
 * GapChecker component
 *
 * Provides a form for selecting parameters to check trade data gaps.
 */
export function GapChecker({
  exchanges = ['binance', 'okx', 'bybit', 'deribit'],
  symbols = [],
  loading = false,
  onCheck,
}: GapCheckerProps) {
  const defaultRange = getDefaultDateRange();
  const [selectedExchange, setSelectedExchange] = useState<string>(
    exchanges[0] || ''
  );
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(defaultRange.from);
  const [toDate, setToDate] = useState<string>(defaultRange.to);

  // Filter symbols by selected exchange
  const filteredSymbols = symbols.filter(
    (s) => s.exchange.toLowerCase() === selectedExchange.toLowerCase()
  );

  // Handle exchange change
  const handleExchangeChange = useCallback((exchange: string) => {
    setSelectedExchange(exchange);
    setSelectedSymbol(''); // Reset symbol when exchange changes
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();

      if (!selectedSymbol || !selectedExchange || !fromDate || !toDate) {
        return;
      }

      const fromTime = new Date(fromDate).getTime();
      const toTime = new Date(toDate).getTime();

      if (fromTime >= toTime) {
        return;
      }

      onCheck({
        symbol: selectedSymbol,
        exchange: selectedExchange,
        fromTime,
        toTime,
      });
    },
    [selectedSymbol, selectedExchange, fromDate, toDate, onCheck]
  );

  // Check if form is valid
  const isValid =
    selectedSymbol &&
    selectedExchange &&
    fromDate &&
    toDate &&
    new Date(fromDate).getTime() < new Date(toDate).getTime();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Check Trade Gaps</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Exchange selector */}
          <div className="space-y-2">
            <label
              htmlFor="exchange"
              className="text-sm font-medium text-foreground"
            >
              Exchange
            </label>
            <select
              id="exchange"
              value={selectedExchange}
              onChange={(e) => handleExchangeChange(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={loading}
            >
              <option value="">Select Exchange</option>
              {exchanges.map((exchange) => (
                <option key={exchange} value={exchange}>
                  {exchange}
                </option>
              ))}
            </select>
          </div>

          {/* Symbol selector */}
          <div className="space-y-2">
            <label
              htmlFor="symbol"
              className="text-sm font-medium text-foreground"
            >
              Symbol
            </label>
            <select
              id="symbol"
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={loading || !selectedExchange}
            >
              <option value="">
                {selectedExchange
                  ? filteredSymbols.length > 0
                    ? 'Select Symbol'
                    : 'No symbols available'
                  : 'Select exchange first'}
              </option>
              {filteredSymbols.map((symbol) => (
                <option key={symbol.id} value={symbol.symbol}>
                  {symbol.symbol}
                </option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label
                htmlFor="fromDate"
                className="text-sm font-medium text-foreground"
              >
                From
              </label>
              <input
                type="datetime-local"
                id="fromDate"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="toDate"
                className="text-sm font-medium text-foreground"
              >
                To
              </label>
              <input
                type="datetime-local"
                id="toDate"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={loading}
              />
            </div>
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            className="w-full"
            disabled={!isValid || loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                Checking...
              </span>
            ) : (
              'Check Gaps'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
