/**
 * ExchangeHealthBadge Component
 *
 * Displays health status with color coding (connected/disconnected/error).
 *
 * Requirements: 4.5
 */

'use client';

import * as React from 'react';
import { Badge, type BadgeVariant } from '../../../../components/ui/badge';
import type { ExchangeHealthStatus } from '../../domain/types';

export interface ExchangeHealthBadgeProps {
  health: ExchangeHealthStatus;
  className?: string;
}

/**
 * Map health status to badge variant
 */
function getHealthVariant(health: ExchangeHealthStatus): BadgeVariant {
  switch (health) {
    case 'healthy':
      return 'success';
    case 'degraded':
      return 'warning';
    case 'unhealthy':
      return 'destructive';
    case 'unknown':
    default:
      return 'secondary';
  }
}

/**
 * Map health status to display label
 */
function getHealthLabel(health: ExchangeHealthStatus): string {
  switch (health) {
    case 'healthy':
      return 'Connected';
    case 'degraded':
      return 'Degraded';
    case 'unhealthy':
      return 'Disconnected';
    case 'unknown':
    default:
      return 'Unknown';
  }
}

/**
 * ExchangeHealthBadge component
 *
 * Displays exchange health status with appropriate color coding.
 */
export function ExchangeHealthBadge({
  health,
  className = '',
}: ExchangeHealthBadgeProps) {
  const variant = getHealthVariant(health);
  const label = getHealthLabel(health);

  return (
    <Badge variant={variant} className={className}>
      <span className="flex items-center gap-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            health === 'healthy'
              ? 'bg-white'
              : health === 'degraded'
              ? 'bg-white'
              : health === 'unhealthy'
              ? 'bg-white'
              : 'bg-gray-400'
          }`}
        />
        {label}
      </span>
    </Badge>
  );
}
