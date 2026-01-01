/**
 * GapSeverityBadge Component
 *
 * Displays severity level of data gaps with color-coded badges.
 * Critical (red), Warning (yellow), Info (blue)
 *
 * Requirements: 10.3
 */

'use client';

import * as React from 'react';
import { Badge, type BadgeVariant } from '../../../../components/ui/badge';
import type { GapSeverity } from '../../domain/types';

export interface GapSeverityBadgeProps {
  /** Severity level */
  severity: GapSeverity;
  /** Optional custom class name */
  className?: string;
}

/**
 * Map severity to badge variant
 */
const severityVariantMap: Record<GapSeverity, BadgeVariant> = {
  critical: 'destructive',
  warning: 'warning',
  info: 'secondary',
};

/**
 * Map severity to display label
 */
const severityLabelMap: Record<GapSeverity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
};

/**
 * GapSeverityBadge - Displays gap severity with appropriate styling
 */
export function GapSeverityBadge({
  severity,
  className = '',
}: GapSeverityBadgeProps) {
  const variant = severityVariantMap[severity];
  const label = severityLabelMap[severity];

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}

/**
 * Utility function to determine severity based on gap metrics
 * Can be used to derive severity from gap data
 */
export function deriveSeverity(
  gapCount: number,
  totalMissingTrades: number
): GapSeverity {
  // Critical: Many gaps or many missing trades
  if (gapCount >= 10 || totalMissingTrades >= 10000) {
    return 'critical';
  }
  // Warning: Moderate gaps or missing trades
  if (gapCount >= 3 || totalMissingTrades >= 1000) {
    return 'warning';
  }
  // Info: Few gaps
  return 'info';
}
