'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { ApiClientProvider } from '@/lib/api-client';
import { UIContainerProvider } from '@/shared/lib/di';
import { RealTimeUpdatesProvider } from '@/lib/hooks';

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Root providers for the application
 * Includes DI container, query client, API client, and real-time updates
 * @requirements 3.2 - UI needs backend data via port out interfaces
 * @requirements 17.1, 17.2 - Real-time status updates
 */
export function Providers({ children }: ProvidersProps) {
  const queryClient = getQueryClient();

  return (
    <UIContainerProvider>
      <QueryClientProvider client={queryClient}>
        <ApiClientProvider>
          <RealTimeUpdatesProvider>{children}</RealTimeUpdatesProvider>
        </ApiClientProvider>
      </QueryClientProvider>
    </UIContainerProvider>
  );
}
