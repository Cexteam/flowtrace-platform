'use client';

import type { Candle } from '@/lib/types';

interface CandleListProps {
  candles: Candle[];
}

export function CandleList({ candles }: CandleListProps) {
  if (candles.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No candle data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 font-medium">Time</th>
            <th className="text-right py-2 px-3 font-medium">Open</th>
            <th className="text-right py-2 px-3 font-medium">High</th>
            <th className="text-right py-2 px-3 font-medium">Low</th>
            <th className="text-right py-2 px-3 font-medium">Close</th>
            <th className="text-right py-2 px-3 font-medium">Volume</th>
          </tr>
        </thead>
        <tbody>
          {candles.map((candle, index) => {
            const isGreen = candle.close >= candle.open;
            return (
              <tr key={index} className="border-b hover:bg-muted/50">
                <td className="py-2 px-3 font-mono text-xs">
                  {new Date(candle.timestamp).toLocaleTimeString()}
                </td>
                <td className="text-right py-2 px-3 font-mono">
                  {candle.open.toFixed(2)}
                </td>
                <td className="text-right py-2 px-3 font-mono">
                  {candle.high.toFixed(2)}
                </td>
                <td className="text-right py-2 px-3 font-mono">
                  {candle.low.toFixed(2)}
                </td>
                <td
                  className={`text-right py-2 px-3 font-mono ${
                    isGreen ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {candle.close.toFixed(2)}
                </td>
                <td className="text-right py-2 px-3 font-mono">
                  {candle.volume.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
