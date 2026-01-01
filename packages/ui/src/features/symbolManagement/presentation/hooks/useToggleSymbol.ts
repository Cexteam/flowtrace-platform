/**
 * useToggleSymbol Hook - Symbol toggle mutations with confirmation
 *
 * Custom hook for toggling symbol status and admin enabled state.
 * All actions require confirmation via dialog.
 *
 * Requirements: 3.1, 3.2, 3.5, 3.6
 */

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from '../../../../components/ui/toast';
import type { Symbol, SymbolStatus } from '../../domain/types';
import {
  activateSymbolAction,
  deactivateSymbolAction,
  enableByAdminAction,
  disableByAdminAction,
} from '../controllers/SymbolController';
import { symbolQueryKeys } from './useSymbolsPaginated';

/**
 * Toggle status mutation params
 */
export interface ToggleStatusParams {
  symbolId: string;
  currentStatus: SymbolStatus | string;
  symbol?: Symbol;
}

/**
 * Toggle admin enabled mutation params
 */
export interface ToggleAdminEnabledParams {
  symbolId: string;
  currentEnabled: boolean;
  symbol?: Symbol;
}

/**
 * Confirmation dialog state
 */
export interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  variant: 'default' | 'destructive';
}

/**
 * Hook return type
 */
export interface UseToggleSymbolReturn {
  toggleStatus: (params: ToggleStatusParams) => void;
  toggleAdminEnabled: (params: ToggleAdminEnabledParams) => void;
  confirmPendingAction: () => void;
  cancelPendingAction: () => void;
  isTogglingStatus: boolean;
  isTogglingAdminEnabled: boolean;
  togglingSymbolIds: Set<string>;
  confirmDialog: ConfirmDialogState;
}

type PendingAction =
  | { type: 'status'; params: ToggleStatusParams }
  | { type: 'admin'; params: ToggleAdminEnabledParams };

/**
 * Hook for toggling symbol status and admin enabled state
 */
export function useToggleSymbol(): UseToggleSymbolReturn {
  const queryClient = useQueryClient();
  const [togglingSymbolIds, setTogglingSymbolIds] = useState<Set<string>>(
    new Set()
  );
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    variant: 'default',
  });
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null
  );

  const addToggling = useCallback((symbolId: string) => {
    setTogglingSymbolIds((prev) => new Set(prev).add(symbolId));
  }, []);

  const removeToggling = useCallback((symbolId: string) => {
    setTogglingSymbolIds((prev) => {
      const next = new Set(prev);
      next.delete(symbolId);
      return next;
    });
  }, []);

  const closeDialog = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, open: false }));
    setPendingAction(null);
  }, []);

  // Status toggle mutation
  const statusMutation = useMutation({
    mutationFn: async ({ symbolId, currentStatus }: ToggleStatusParams) => {
      if (currentStatus === 'active') {
        return deactivateSymbolAction(symbolId);
      } else {
        return activateSymbolAction(symbolId);
      }
    },
    onMutate: async ({ symbolId }) => {
      addToggling(symbolId);
      await queryClient.cancelQueries({ queryKey: symbolQueryKeys.lists() });
    },
    onSuccess: (result, { currentStatus }) => {
      if (result.success) {
        const action = currentStatus === 'active' ? 'stopped' : 'started';
        toast.success(`Symbol ${action} successfully`);
        queryClient.invalidateQueries({ queryKey: symbolQueryKeys.lists() });
      } else {
        toast.error(result.error || 'Failed to toggle symbol status');
      }
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to toggle status'
      );
    },
    onSettled: (_, __, { symbolId }) => {
      removeToggling(symbolId);
    },
  });

  // Admin enabled toggle mutation
  const adminEnabledMutation = useMutation({
    mutationFn: async ({
      symbolId,
      currentEnabled,
    }: ToggleAdminEnabledParams) => {
      if (currentEnabled) {
        return disableByAdminAction(symbolId);
      } else {
        return enableByAdminAction(symbolId);
      }
    },
    onMutate: async ({ symbolId }) => {
      addToggling(symbolId);
      await queryClient.cancelQueries({ queryKey: symbolQueryKeys.lists() });
    },
    onSuccess: (result, { currentEnabled }) => {
      if (result.success) {
        const action = currentEnabled ? 'locked' : 'unlocked';
        toast.success(`Symbol ${action} successfully`);
        queryClient.invalidateQueries({ queryKey: symbolQueryKeys.lists() });
      } else {
        toast.error(result.error || 'Failed to toggle admin status');
      }
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to toggle admin status'
      );
    },
    onSettled: (_, __, { symbolId }) => {
      removeToggling(symbolId);
    },
  });

  // Toggle status with confirmation
  const toggleStatus = useCallback((params: ToggleStatusParams) => {
    const { currentStatus, symbol } = params;
    const symbolName = symbol?.symbol || 'this symbol';
    const isActivating = currentStatus !== 'active';

    setConfirmDialog({
      open: true,
      title: isActivating ? 'Start Symbol?' : 'Stop Symbol?',
      description: isActivating
        ? `Are you sure you want to start streaming for "${symbolName}"? This will begin data collection.`
        : `Are you sure you want to stop streaming for "${symbolName}"? This will pause data collection.`,
      confirmLabel: isActivating ? 'Start' : 'Stop',
      variant: isActivating ? 'default' : 'destructive',
    });
    setPendingAction({ type: 'status', params });
  }, []);

  // Toggle admin with confirmation
  const toggleAdminEnabled = useCallback((params: ToggleAdminEnabledParams) => {
    const { currentEnabled, symbol } = params;
    const symbolName = symbol?.symbol || 'this symbol';
    const isEnabling = !currentEnabled;

    setConfirmDialog({
      open: true,
      title: isEnabling ? 'Unlock Symbol?' : 'Lock Symbol?',
      description: isEnabling
        ? `Are you sure you want to unlock "${symbolName}"? This will allow the symbol to be activated.`
        : `Are you sure you want to lock "${symbolName}"? This will prevent the symbol from being activated and stop any running streams.`,
      confirmLabel: isEnabling ? 'Unlock' : 'Lock',
      variant: isEnabling ? 'default' : 'destructive',
    });
    setPendingAction({ type: 'admin', params });
  }, []);

  // Confirm pending action
  const confirmPendingAction = useCallback(() => {
    if (!pendingAction) return;

    if (pendingAction.type === 'status') {
      statusMutation.mutate(pendingAction.params);
    } else {
      adminEnabledMutation.mutate(pendingAction.params);
    }
    closeDialog();
  }, [pendingAction, statusMutation, adminEnabledMutation, closeDialog]);

  // Cancel pending action
  const cancelPendingAction = useCallback(() => {
    closeDialog();
  }, [closeDialog]);

  return {
    toggleStatus,
    toggleAdminEnabled,
    confirmPendingAction,
    cancelPendingAction,
    isTogglingStatus: statusMutation.isPending,
    isTogglingAdminEnabled: adminEnabledMutation.isPending,
    togglingSymbolIds,
    confirmDialog,
  };
}

// Re-export types for backward compatibility
export type { ConfirmDialogState as WarningDialogState };
