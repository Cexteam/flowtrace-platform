/**
 * CandleDetailPanel Component
 *
 * Displays detailed footprint information for a selected candle.
 * Shows volume profile chart and aggregation data with buy/sell volume at each price level.
 *
 * Requirements: 14.1, 14.2, 14.3
 */

'use client';

import * as React from 'react';
import type { CandleDetail, PriceLevel } from '../../domain/types';

export interface CandleDetailPanelProps {
  /** Candle detail with footprint data */
  candleDetail: CandleDetail | null;
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string | null;
  /** Callback to close the panel */
  onClose?: () => void;
  /** Custom class name */
  className?: string;
}

/**
 * Format timestamp to readable date/time
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Format price with appropriate precision
 */
function formatPrice(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  });
}

/**
 * Format volume
 */
function formatVolume(volume: number): string {
  return volume.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * VolumeProfileChart - Renders the footprint volume profile
 */
function VolumeProfileChart({ priceLevels }: { priceLevels: PriceLevel[] }) {
  if (!priceLevels || priceLevels.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No footprint data available
      </div>
    );
  }

  // Sort price levels by price descending (highest price at top)
  const sortedLevels = [...priceLevels].sort((a, b) => b.price - a.price);

  // Find max volume for scaling
  const maxVolume = Math.max(
    ...sortedLevels.map((l) => Math.max(l.buyVolume, l.sellVolume))
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-3 bg-muted px-4 py-2 text-sm font-medium">
        <div className="text-green-500">Buy Volume</div>
        <div className="text-center">Price</div>
        <div className="text-right text-red-500">Sell Volume</div>
      </div>

      {/* Price Levels */}
      <div className="divide-y max-h-[400px] overflow-y-auto">
        {sortedLevels.map((level, index) => {
          const buyWidth =
            maxVolume > 0 ? (level.buyVolume / maxVolume) * 100 : 0;
          const sellWidth =
            maxVolume > 0 ? (level.sellVolume / maxVolume) * 100 : 0;

          return (
            <div
              key={index}
              className="grid grid-cols-3 px-4 py-1 items-center hover:bg-muted/50"
            >
              {/* Buy Volume Bar */}
              <div className="flex items-center">
                <div
                  className="h-5 bg-green-500/30 rounded-r"
                  style={{
                    width: `${buyWidth}%`,
                    minWidth: level.buyVolume > 0 ? '4px' : '0',
                  }}
                />
                <span className="ml-2 text-sm font-mono text-green-500">
                  {level.buyVolume > 0 ? formatVolume(level.buyVolume) : '-'}
                </span>
              </div>

              {/* Price */}
              <div className="text-center font-mono text-sm">
                {formatPrice(level.price)}
              </div>

              {/* Sell Volume Bar */}
              <div className="flex items-center justify-end">
                <span className="mr-2 text-sm font-mono text-red-500">
                  {level.sellVolume > 0 ? formatVolume(level.sellVolume) : '-'}
                </span>
                <div
                  className="h-5 bg-red-500/30 rounded-l"
                  style={{
                    width: `${sellWidth}%`,
                    minWidth: level.sellVolume > 0 ? '4px' : '0',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * CandleDetailPanel - Panel showing detailed candle and footprint information
 */
export function CandleDetailPanel({
  candleDetail,
  loading = false,
  error = null,
  onClose,
  className = '',
}: CandleDetailPanelProps) {
  // Loading state
  if (loading) {
    return (
      <div className={`bg-background border rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close panel"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`bg-background border rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Candle Detail</h3>
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close panel"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
        <div className="text-center py-8 text-destructive">
          <svg
            className="h-12 w-12 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // No data state
  if (!candleDetail) {
    return (
      <div className={`bg-background border rounded-lg p-6 ${className}`}>
        <div className="text-center py-8 text-muted-foreground">
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
          <p>Select a candle to view footprint details</p>
        </div>
      </div>
    );
  }

  const isGreen = candleDetail.close >= candleDetail.open;

  return (
    <div className={`bg-background border rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">
            {candleDetail.symbol} - {candleDetail.timeframe}
          </h3>
          <p className="text-sm text-muted-foreground">
            {formatTime(candleDetail.openTime)}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close panel"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 bg-green-500/10 rounded-lg">
          <div className="text-2xl font-bold text-green-500">
            {formatVolume(candleDetail.buyVolume)}
          </div>
          <div className="text-sm text-muted-foreground">Buy Volume</div>
        </div>
        <div className="text-center p-4 bg-muted rounded-lg">
          <div
            className={`text-2xl font-bold ${
              candleDetail.delta >= 0 ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {candleDetail.delta >= 0 ? '+' : ''}
            {formatVolume(candleDetail.delta)}
          </div>
          <div className="text-sm text-muted-foreground">Delta</div>
        </div>
        <div className="text-center p-4 bg-red-500/10 rounded-lg">
          <div className="text-2xl font-bold text-red-500">
            {formatVolume(candleDetail.sellVolume)}
          </div>
          <div className="text-sm text-muted-foreground">Sell Volume</div>
        </div>
      </div>

      {/* OHLC Info */}
      <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-muted/30 rounded-lg">
        <div>
          <div className="text-xs text-muted-foreground uppercase">Open</div>
          <div className="font-mono">{formatPrice(candleDetail.open)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground uppercase">High</div>
          <div className="font-mono text-green-500">
            {formatPrice(candleDetail.high)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground uppercase">Low</div>
          <div className="font-mono text-red-500">
            {formatPrice(candleDetail.low)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground uppercase">Close</div>
          <div
            className={`font-mono ${
              isGreen ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {formatPrice(candleDetail.close)}
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 bg-muted/30 rounded-lg">
          <div className="text-xs text-muted-foreground uppercase">
            Total Volume
          </div>
          <div className="font-mono">{formatVolume(candleDetail.volume)}</div>
        </div>
        <div className="p-3 bg-muted/30 rounded-lg">
          <div className="text-xs text-muted-foreground uppercase">
            Trade Count
          </div>
          <div className="font-mono">
            {candleDetail.tradeCount.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Volume Profile Chart */}
      <div>
        <h4 className="text-sm font-medium mb-3">Volume Profile</h4>
        <VolumeProfileChart priceLevels={candleDetail.priceLevels} />
      </div>
    </div>
  );
}
