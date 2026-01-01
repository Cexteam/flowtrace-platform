/**
 * RealTimeUpdatesProvider - Component that enables real-time status updates
 *
 * This component sets up IPC event listeners for symbol and exchange status changes
 * and automatically invalidates React Query cache when updates occur.
 *
 * Requirements: 17.1, 17.2
 */

'use client';

import { useRealTimeUpdates } from './useRealTimeUpdates';

interface RealTimeUpdatesProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component that enables real-time status updates throughout the app
 *
 * Place this component inside QueryClientProvider to enable automatic
 * cache invalidation when symbol or exchange status changes.
 */
export function RealTimeUpdatesProvider({
  children,
}: RealTimeUpdatesProviderProps) {
  // Set up real-time updates - this will listen for IPC events
  // and invalidate React Query cache automatically
  useRealTimeUpdates({
    enableSymbolUpdates: true,
    enableExchangeUpdates: true,
  });

  return <>{children}</>;
}
