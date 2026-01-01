'use client';

import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui';

/**
 * Home page with quick access cards
 * Navigation is handled by the Sidebar component in MainLayout
 */
export default function HomePage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-foreground">
          Welcome to FlowTrace
        </h1>
        <p className="text-muted-foreground mt-2">
          Real-time trading data and footprint analysis
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/workers">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle>Workers</CardTitle>
              <CardDescription>
                Manage worker processes and health
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Monitor worker status, spawn new workers, and view health
                metrics
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/exchanges">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle>Exchanges</CardTitle>
              <CardDescription>Configure exchange connections</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Enable/disable exchanges and monitor connection health
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/symbols">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle>Symbols</CardTitle>
              <CardDescription>Manage trading symbols</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Activate/deactivate symbols and sync from exchanges
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/data-quality">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle>Data Quality</CardTitle>
              <CardDescription>Check trade data gaps</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Analyze data completeness and identify missing trades
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/footprint">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle>Footprint</CardTitle>
              <CardDescription>Analyze order flow</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Detailed bid/ask volume at each price level
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle>Dashboard</CardTitle>
              <CardDescription>Market overview</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Monitor multiple symbols with live price updates
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
