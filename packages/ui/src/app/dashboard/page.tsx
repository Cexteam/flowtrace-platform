'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/lib/api-client';
import { useSymbolStore } from '@/stores/symbol-store';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
} from '@/components/ui';
import { CandleList } from '@/components/charts/CandleList';

export default function DashboardPage() {
  const apiClient = useApiClient();
  const { activeSymbol, symbols, setActiveSymbol } = useSymbolStore();

  const {
    data: candles,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['candles', activeSymbol, '1m'],
    queryFn: () => apiClient.getCandles(activeSymbol, '1m', 50),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Real-time market data</p>
          </div>
          <Link href="/" className="text-primary hover:underline">
            ← Back to Home
          </Link>
        </header>

        {/* Symbol Selector */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {symbols.map((symbol) => (
            <Button
              key={symbol}
              variant={symbol === activeSymbol ? 'default' : 'outline'}
              onClick={() => setActiveSymbol(symbol)}
            >
              {symbol}
            </Button>
          ))}
        </div>

        {/* Candle Data */}
        <Card>
          <CardHeader>
            <CardTitle>{activeSymbol} - 1m Candles</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="text-center py-8 text-muted-foreground">
                Loading candles...
              </div>
            )}
            {error && (
              <div className="text-center py-8 text-destructive">
                Error loading candles: {(error as Error).message}
              </div>
            )}
            {candles && <CandleList candles={candles} />}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
