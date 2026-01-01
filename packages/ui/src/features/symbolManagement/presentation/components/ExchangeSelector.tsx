/**
 * ExchangeSelector Component (Tabs Version)
 *
 * Displays enabled exchanges as selectable tabs with symbol counts.
 * Shows total and active symbol counts per exchange.
 * Handles empty state with link to Exchange Management.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

'use client';

import * as React from 'react';
import Link from 'next/link';

/**
 * Exchange data for the selector
 */
export interface ExchangeTabData {
  name: string;
  displayName: string;
  isEnabled: boolean;
  symbolCount: number;
  activeSymbolCount: number;
}

export interface ExchangeSelectorProps {
  /** List of exchanges to display */
  exchanges: ExchangeTabData[];
  /** Currently selected exchange name */
  selectedExchange: string | null;
  /** Callback when an exchange is selected */
  onSelect: (exchangeName: string) => void;
  /** Whether to show symbol counts */
  showSymbolCount?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * ExchangeSelector - Tabs version for selecting exchanges
 *
 * Displays only enabled exchanges as tabs.
 * Shows symbol count (total and active) per exchange.
 * Handles empty state with link to Exchange Management.
 */
export function ExchangeSelector({
  exchanges,
  selectedExchange,
  onSelect,
  showSymbolCount = true,
  loading = false,
  className = '',
}: ExchangeSelectorProps) {
  // Filter to only show enabled exchanges
  const enabledExchanges = React.useMemo(
    () => exchanges.filter((e) => e.isEnabled),
    [exchanges]
  );

  // Auto-select first exchange if none selected and exchanges available
  React.useEffect(() => {
    if (!selectedExchange && enabledExchanges.length > 0) {
      onSelect(enabledExchanges[0].name);
    }
  }, [selectedExchange, enabledExchanges, onSelect]);

  // Loading state
  if (loading) {
    return (
      <div className={`flex gap-2 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-10 w-32 bg-muted animate-pulse rounded-lg"
          />
        ))}
      </div>
    );
  }

  // Empty state - no enabled exchanges
  if (enabledExchanges.length === 0) {
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
          No exchanges are enabled. Enable exchanges to view and manage symbols.
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
      className={`flex flex-wrap gap-2 border-b border-border pb-2 ${className}`}
      role="tablist"
      aria-label="Exchange selection"
    >
      {enabledExchanges.map((exchange) => {
        const isSelected = selectedExchange === exchange.name;

        return (
          <button
            key={exchange.name}
            role="tab"
            aria-selected={isSelected}
            aria-controls={`panel-${exchange.name}`}
            onClick={() => onSelect(exchange.name)}
            className={`
              relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              transition-all duration-200 ease-in-out
              ${
                isSelected
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            `}
          >
            <span className="capitalize">{exchange.displayName}</span>
            {showSymbolCount && (
              <span
                className={`
                  inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 
                  text-xs rounded-full
                  ${
                    isSelected
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-background text-muted-foreground'
                  }
                `}
                title={`${exchange.activeSymbolCount} active / ${exchange.symbolCount} total`}
              >
                {exchange.activeSymbolCount}/{exchange.symbolCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
