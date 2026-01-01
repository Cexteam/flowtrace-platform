'use client';

/**
 * Exchanges page - Exchange Management UI
 *
 * Displays exchange list and detail views for managing exchange connections.
 * Refactored to use DataTable with pagination, search, and filter support.
 *
 * Requirements: 4.1 to 5.4
 */

import { useState, useCallback } from 'react';
import {
  ExchangeList,
  ExchangeDetail,
} from '../../features/exchangeManagement/presentation/components';
import { useExchangesPaginated } from '../../features/exchangeManagement/presentation/hooks';
import type { Exchange } from '../../features/exchangeManagement/domain/types';

export default function ExchangesPage() {
  const [selectedExchangeName, setSelectedExchangeName] = useState<
    string | null
  >(null);
  const { exchanges } = useExchangesPaginated(100); // Get all for detail lookup

  // Find the selected exchange from the list
  const selectedExchange: Exchange | undefined = exchanges.find(
    (e) => e.name === selectedExchangeName
  );

  const handleSelectExchange = useCallback((exchangeName: string) => {
    setSelectedExchangeName(exchangeName);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedExchangeName(null);
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Exchanges</h1>
        <p className="text-muted-foreground mt-1">
          Configure exchange connections and monitor health
        </p>
      </header>

      {selectedExchange ? (
        <ExchangeDetail exchange={selectedExchange} onBack={handleBack} />
      ) : (
        <ExchangeList onSelectExchange={handleSelectExchange} />
      )}
    </div>
  );
}
