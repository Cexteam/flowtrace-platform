/**
 * SymbolStatusToggle Component
 *
 * Toggle switches for symbol status (Active/Inactive) and admin enabled.
 * Shows loading state during action.
 *
 * Requirements: 3.1, 3.2, 3.4, 3.5
 */

'use client';

import * as React from 'react';

export interface SymbolStatusToggleProps {
  /** Symbol ID */
  symbolId: string;
  /** Current status */
  status: 'active' | 'inactive' | string;
  /** Current admin enabled state */
  enabledByAdmin: boolean;
  /** Whether the toggle is loading */
  loading?: boolean;
  /** Callback when status toggle is clicked */
  onToggleStatus?: (symbolId: string, currentStatus: string) => void;
  /** Callback when admin enabled toggle is clicked */
  onToggleAdminEnabled?: (symbolId: string, currentEnabled: boolean) => void;
  /** Whether to show labels */
  showLabels?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Toggle switch component
 */
interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  id: string;
}

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  loading = false,
  label,
  id,
}: ToggleSwitchProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled || loading}
        onClick={onChange}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full
          transition-colors duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
          ${
            disabled || loading
              ? 'cursor-not-allowed opacity-50'
              : 'cursor-pointer'
          }
          ${checked ? 'bg-primary' : 'bg-muted'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white shadow-sm
            transition-transform duration-200 ease-in-out
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        >
          {loading && (
            <span className="absolute inset-0 flex items-center justify-center">
              <svg
                className="h-3 w-3 animate-spin text-primary"
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
            </span>
          )}
        </span>
      </button>
      {label && (
        <label
          htmlFor={id}
          className={`text-sm ${
            disabled ? 'text-muted-foreground' : 'text-foreground'
          }`}
        >
          {label}
        </label>
      )}
    </div>
  );
}

/**
 * SymbolStatusToggle - Toggle switches for symbol status and admin enabled
 */
export function SymbolStatusToggle({
  symbolId,
  status,
  enabledByAdmin,
  loading = false,
  onToggleStatus,
  onToggleAdminEnabled,
  showLabels = true,
  className = '',
}: SymbolStatusToggleProps) {
  const isActive = status === 'active';

  const handleStatusToggle = React.useCallback(() => {
    onToggleStatus?.(symbolId, status);
  }, [symbolId, status, onToggleStatus]);

  const handleAdminEnabledToggle = React.useCallback(() => {
    onToggleAdminEnabled?.(symbolId, enabledByAdmin);
  }, [symbolId, enabledByAdmin, onToggleAdminEnabled]);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Status Toggle */}
      <div className="flex items-center justify-between">
        {showLabels && (
          <span className="text-sm text-muted-foreground">Status</span>
        )}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs ${
              isActive ? 'text-green-600' : 'text-muted-foreground'
            }`}
          >
            {isActive ? 'Active' : 'Inactive'}
          </span>
          <ToggleSwitch
            id={`status-toggle-${symbolId}`}
            checked={isActive}
            onChange={handleStatusToggle}
            disabled={loading}
            loading={loading}
            label={showLabels ? undefined : `Toggle status for ${symbolId}`}
          />
        </div>
      </div>

      {/* Admin Enabled Toggle */}
      <div className="flex items-center justify-between">
        {showLabels && (
          <span className="text-sm text-muted-foreground">Admin Enabled</span>
        )}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs ${
              enabledByAdmin ? 'text-green-600' : 'text-muted-foreground'
            }`}
          >
            {enabledByAdmin ? 'Enabled' : 'Disabled'}
          </span>
          <ToggleSwitch
            id={`admin-toggle-${symbolId}`}
            checked={enabledByAdmin}
            onChange={handleAdminEnabledToggle}
            disabled={loading}
            loading={loading}
            label={
              showLabels ? undefined : `Toggle admin enabled for ${symbolId}`
            }
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Compact version of SymbolStatusToggle for table rows
 */
export interface CompactSymbolToggleProps {
  /** Symbol ID */
  symbolId: string;
  /** Current status */
  status: 'active' | 'inactive' | string;
  /** Current admin enabled state */
  enabledByAdmin: boolean;
  /** Whether the toggle is loading */
  loading?: boolean;
  /** Callback when status toggle is clicked */
  onToggleStatus?: (symbolId: string, currentStatus: string) => void;
  /** Callback when admin enabled toggle is clicked */
  onToggleAdminEnabled?: (symbolId: string, currentEnabled: boolean) => void;
}

export function CompactSymbolToggle({
  symbolId,
  status,
  enabledByAdmin,
  loading = false,
  onToggleStatus,
  onToggleAdminEnabled,
}: CompactSymbolToggleProps) {
  const isActive = status === 'active';

  return (
    <div className="flex items-center gap-4">
      <ToggleSwitch
        id={`status-${symbolId}`}
        checked={isActive}
        onChange={() => onToggleStatus?.(symbolId, status)}
        disabled={loading}
        loading={loading}
        label="Status"
      />
      <ToggleSwitch
        id={`admin-${symbolId}`}
        checked={enabledByAdmin}
        onChange={() => onToggleAdminEnabled?.(symbolId, enabledByAdmin)}
        disabled={loading}
        loading={loading}
        label="Admin"
      />
    </div>
  );
}
