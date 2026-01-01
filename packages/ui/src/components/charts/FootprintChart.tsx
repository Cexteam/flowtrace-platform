'use client';

import type { Footprint } from '@/lib/types';

interface FootprintChartProps {
  footprint: Footprint;
}

export function FootprintChart({ footprint }: FootprintChartProps) {
  if (!footprint.clusters || footprint.clusters.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No footprint data available
      </div>
    );
  }

  // Sort clusters by price descending (highest price at top)
  const sortedClusters = [...footprint.clusters].sort(
    (a, b) => b.price - a.price
  );

  // Find max volume for scaling
  const maxVolume = Math.max(
    ...sortedClusters.map((c) => Math.max(c.bidVolume, c.askVolume))
  );

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 bg-green-500/10 rounded-lg">
          <div className="text-2xl font-bold text-green-500">
            {footprint.totalBidVolume.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">Total Bid Volume</div>
        </div>
        <div className="text-center p-4 bg-muted rounded-lg">
          <div
            className={`text-2xl font-bold ${
              footprint.delta >= 0 ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {footprint.delta >= 0 ? '+' : ''}
            {footprint.delta.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">Delta</div>
        </div>
        <div className="text-center p-4 bg-red-500/10 rounded-lg">
          <div className="text-2xl font-bold text-red-500">
            {footprint.totalAskVolume.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">Total Ask Volume</div>
        </div>
      </div>

      {/* Footprint Clusters */}
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-3 bg-muted px-4 py-2 text-sm font-medium">
          <div className="text-green-500">Bid Volume</div>
          <div className="text-center">Price</div>
          <div className="text-right text-red-500">Ask Volume</div>
        </div>
        <div className="divide-y">
          {sortedClusters.map((cluster, index) => {
            const bidWidth =
              maxVolume > 0 ? (cluster.bidVolume / maxVolume) * 100 : 0;
            const askWidth =
              maxVolume > 0 ? (cluster.askVolume / maxVolume) * 100 : 0;

            return (
              <div
                key={index}
                className="grid grid-cols-3 px-4 py-1 items-center"
              >
                {/* Bid Volume Bar */}
                <div className="flex items-center">
                  <div
                    className="h-5 bg-green-500/30 rounded-r"
                    style={{
                      width: `${bidWidth}%`,
                      minWidth: cluster.bidVolume > 0 ? '4px' : '0',
                    }}
                  />
                  <span className="ml-2 text-sm font-mono text-green-500">
                    {cluster.bidVolume > 0
                      ? cluster.bidVolume.toLocaleString()
                      : '-'}
                  </span>
                </div>

                {/* Price */}
                <div className="text-center font-mono text-sm">
                  {cluster.price.toFixed(2)}
                </div>

                {/* Ask Volume Bar */}
                <div className="flex items-center justify-end">
                  <span className="mr-2 text-sm font-mono text-red-500">
                    {cluster.askVolume > 0
                      ? cluster.askVolume.toLocaleString()
                      : '-'}
                  </span>
                  <div
                    className="h-5 bg-red-500/30 rounded-l"
                    style={{
                      width: `${askWidth}%`,
                      minWidth: cluster.askVolume > 0 ? '4px' : '0',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
