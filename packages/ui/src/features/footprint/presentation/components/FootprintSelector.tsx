/**
 * FootprintSelector Component
 *
 * Multi-level selector for exchange, symbol, timeframe, and date range.
 * Displays only enabled exchanges and active symbols.
 * Handles empty state with guidance.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { TIMEFRAME_OPTIONS, type Timeframe } from '../../domain/types';

/**
 * Exchange data for the selector
 */
export interface FootprintExchangeData {
  name: string;
  displayName: string;
  isEnabled: boolean;
}

/**
 * Symbol data for the selector
 */
export interface FootprintSymbolData {
  symbol: string;
  exchange: string;
  isActive: boolean;
}

export interface FootprintSelectorProps {
  /** List of exchanges */
  exchanges: FootprintExchangeData[];
  /** List of symbols */
  symbols: FootprintSymbolData[];
  /** Currently selected exchange */
  selectedExchange: string | null;
  /** Currently selected symbol */
  selectedSymbol: string | null;
  /** Currently selected timeframe */
  selectedTimeframe: Timeframe;
  /** Start date for date range */
  startDate: Date | null;
  /** End date for date range */
  endDate: Date | null;
  /** Callback when exchange is selected */
  onExchangeChange: (exchange: string | null) => void;
  /** Callback when symbol is selected */
  onSymbolChange: (symbol: string | null) => void;
  /** Callback when timeframe is selected */
  onTimeframeChange: (timeframe: Timeframe) => void;
  /** Callback when start date changes */
  onStartDateChange: (date: Date | null) => void;
  /** Callback when end date changes */
  onEndDateChange: (date: Date | null) => void;
  /** Loading state for exchanges */
  exchangesLoading?: boolean;
  /** Loading state for symbols */
  symbolsLoading?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * FootprintSelector - Multi-level selector for footprint page
 *
 * Displays dropdowns for exchange, symbol, timeframe, and date range.
 * Symbol dropdown is filtered by selected exchange and shows only active symbols.
 * Handles empty states with appropriate guidance.
 */
export function FootprintSelector({
  exchanges,
  symbols,
  selectedExchange,
  selectedSymbol,
  selectedTimeframe,
  startDate,
  endDate,
  onExchangeChange,
  onSymbolChange,
  onTimeframeChange,
  onStartDateChange,
  onEndDateChange,
  exchangesLoading = false,
  symbolsLoading = false,
  className = '',
}: FootprintSelectorProps) {
  // Filter to only show enabled exchanges
  const enabledExchanges = React.useMemo(
    () => exchanges.filter((e) => e.isEnabled),
    [exchanges]
  );

  // Filter symbols by selected exchange and active status
  const filteredSymbols = React.useMemo(() => {
    if (!selectedExchange) return [];
    return symbols.filter((s) => s.exchange === selectedExchange && s.isActive);
  }, [symbols, selectedExchange]);

  // Format date for input
  const formatDateForInput = (date: Date | null): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  // Parse date from input
  const parseDateFromInput = (value: string): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  };

  // Empty state - no enabled exchanges
  if (!exchangesLoading && enabledExchanges.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-8 px-4 border border-dashed border-border rounded-lg bg-muted/30 ${className}`}
      >
        <svg
          className="w-12 h-12 text-muted-foreground mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <p className="text-muted-foreground text-center mb-4">
          No exchanges are enabled. Enable exchanges to view footprint data.
        </p>
        <Link
          href="/exchanges"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Go to Exchange Management
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-end gap-4 p-4 bg-muted/30 rounded-lg border border-border ${className}`}
    >
      {/* Exchange Dropdown */}
      <div className="flex flex-col gap-1.5 min-w-[160px]">
        <label
          htmlFor="exchange-select"
          className="text-sm font-medium text-muted-foreground"
        >
          Exchange
        </label>
        <select
          id="exchange-select"
          value={selectedExchange || ''}
          onChange={(e) => {
            const value = e.target.value || null;
            onExchangeChange(value);
            // Reset symbol when exchange changes
            onSymbolChange(null);
          }}
          disabled={exchangesLoading}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
        >
          <option value="">Select exchange...</option>
          {enabledExchanges.map((exchange) => (
            <option key={exchange.name} value={exchange.name}>
              {exchange.displayName}
            </option>
          ))}
        </select>
      </div>

      {/* Symbol Dropdown */}
      <div className="flex flex-col gap-1.5 min-w-[180px]">
        <label
          htmlFor="symbol-select"
          className="text-sm font-medium text-muted-foreground"
        >
          Symbol
        </label>
        <select
          id="symbol-select"
          value={selectedSymbol || ''}
          onChange={(e) => onSymbolChange(e.target.value || null)}
          disabled={!selectedExchange || symbolsLoading}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
        >
          <option value="">
            {!selectedExchange
              ? 'Select exchange first...'
              : filteredSymbols.length === 0
              ? 'No active symbols'
              : 'Select symbol...'}
          </option>
          {filteredSymbols.map((symbol) => (
            <option key={symbol.symbol} value={symbol.symbol}>
              {symbol.symbol}
            </option>
          ))}
        </select>
        {selectedExchange &&
          filteredSymbols.length === 0 &&
          !symbolsLoading && (
            <p className="text-xs text-muted-foreground">
              No active symbols for this exchange.{' '}
              <Link href="/symbols" className="text-primary hover:underline">
                Manage symbols
              </Link>
            </p>
          )}
      </div>

      {/* Timeframe Dropdown */}
      <div className="flex flex-col gap-1.5 min-w-[140px]">
        <label
          htmlFor="timeframe-select"
          className="text-sm font-medium text-muted-foreground"
        >
          Timeframe
        </label>
        <select
          id="timeframe-select"
          value={selectedTimeframe}
          onChange={(e) => onTimeframeChange(e.target.value as Timeframe)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {TIMEFRAME_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Date Range */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-muted-foreground">
          Date Range
        </label>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={formatDateForInput(startDate)}
            onChange={(e) =>
              onStartDateChange(parseDateFromInput(e.target.value))
            }
            className="h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Start date"
          />
          <span className="text-muted-foreground">to</span>
          <input
            type="date"
            value={formatDateForInput(endDate)}
            onChange={(e) =>
              onEndDateChange(parseDateFromInput(e.target.value))
            }
            className="h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="End date"
          />
        </div>
      </div>
    </div>
  );
}
