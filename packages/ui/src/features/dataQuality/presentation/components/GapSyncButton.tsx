/**
 * GapSyncButton Component
 *
 * Sync button with tooltip for triggering gap data synchronization.
 * Currently shows placeholder response for future implementation.
 *
 * Requirements: 11.1, 11.2, 11.3
 */

'use client';

import * as React from 'react';
import { Button } from '../../../../components/ui/button';

export interface GapSyncButtonProps {
  /** Symbol to sync */
  symbol: string;
  /** Exchange name */
  exchange: string;
  /** Callback when sync is triggered */
  onSync?: (symbol: string, exchange: string) => void;
  /** Loading state */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * GapSyncButton - Button to trigger gap synchronization
 *
 * Shows tooltip explaining sync functionality.
 * Displays placeholder response for future implementation.
 */
export function GapSyncButton({
  symbol,
  exchange,
  onSync,
  loading = false,
  disabled = false,
  className = '',
}: GapSyncButtonProps) {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [showPlaceholder, setShowPlaceholder] = React.useState(false);

  const handleClick = () => {
    if (onSync) {
      onSync(symbol, exchange);
    } else {
      // Show placeholder message
      setShowPlaceholder(true);
      setTimeout(() => setShowPlaceholder(false), 3000);
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={disabled || loading}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="gap-1.5"
      >
        {loading ? (
          <>
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Syncing...</span>
          </>
        ) : (
          <>
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>Sync</span>
          </>
        )}
      </Button>

      {/* Tooltip */}
      {showTooltip && !showPlaceholder && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-md shadow-md border border-border whitespace-nowrap z-50">
          <div className="font-medium mb-1">Sync Gap Data</div>
          <div className="text-muted-foreground">
            Recover missing trade data for {symbol}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-popover" />
          </div>
        </div>
      )}

      {/* Placeholder message */}
      {showPlaceholder && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-muted text-muted-foreground text-xs rounded-md shadow-md border border-border whitespace-nowrap z-50">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-yellow-500"
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
            <span>Sync functionality coming soon</span>
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-muted" />
          </div>
        </div>
      )}
    </div>
  );
}
