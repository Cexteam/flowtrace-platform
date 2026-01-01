/**
 * ExchangeStatusToggle Component
 *
 * Toggle switch for enable/disable exchange with confirmation dialog.
 *
 * Requirements: 5.1, 5.2
 */

'use client';

import * as React from 'react';
import { useState } from 'react';
import { ConfirmDialog } from '../../../../components/ui/dialog';
import { Switch } from '../../../../components/ui/switch';
import type { Exchange } from '../../domain/types';

export interface ExchangeStatusToggleProps {
  exchange: Exchange;
  onToggle: (exchangeName: string, enable: boolean) => void;
  isToggling?: boolean;
  disabled?: boolean;
}

/**
 * ExchangeStatusToggle component
 *
 * Displays a switch for enabling/disabling an exchange.
 * Shows confirmation dialog for both enable and disable actions.
 */
export function ExchangeStatusToggle({
  exchange,
  onToggle,
  isToggling = false,
  disabled = false,
}: ExchangeStatusToggleProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    'enable' | 'disable' | null
  >(null);

  const handleSwitchChange = (checked: boolean) => {
    // Show confirmation dialog for both enable and disable
    setPendingAction(checked ? 'enable' : 'disable');
    setShowConfirmDialog(true);
  };

  const handleConfirm = () => {
    if (pendingAction) {
      onToggle(exchange.name, pendingAction === 'enable');
    }
    setShowConfirmDialog(false);
    setPendingAction(null);
  };

  const handleCancel = () => {
    setShowConfirmDialog(false);
    setPendingAction(null);
  };

  const isDisabled =
    disabled || isToggling || exchange.implementationStatus !== 'implemented';

  const dialogTitle =
    pendingAction === 'enable' ? 'Enable Exchange' : 'Disable Exchange';
  const dialogDescription =
    pendingAction === 'enable'
      ? `Are you sure you want to enable ${exchange.displayName}? This will allow data collection for this exchange.`
      : `Are you sure you want to disable ${exchange.displayName}? This will stop all data collection and deactivate all symbols belonging to this exchange.`;
  const confirmLabel = pendingAction === 'enable' ? 'Enable' : 'Disable';
  const dialogVariant = pendingAction === 'enable' ? 'default' : 'destructive';

  return (
    <div
      className="flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {isToggling ? (
        <div className="flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4 text-muted-foreground"
            xmlns="http://www.w3.org/2000/svg"
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
          <span className="text-xs text-muted-foreground">Updating...</span>
        </div>
      ) : (
        <div
          title={
            exchange.implementationStatus !== 'implemented'
              ? 'Exchange not implemented'
              : exchange.isEnabled
              ? 'Click to disable this exchange'
              : 'Click to enable this exchange'
          }
        >
          <Switch
            checked={exchange.isEnabled}
            onCheckedChange={handleSwitchChange}
            disabled={isDisabled}
          />
        </div>
      )}

      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title={dialogTitle}
        description={dialogDescription}
        confirmLabel={confirmLabel}
        cancelLabel="Cancel"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        variant={dialogVariant as 'default' | 'destructive'}
      />
    </div>
  );
}
