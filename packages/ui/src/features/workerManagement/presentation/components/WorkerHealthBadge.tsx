/**
 * WorkerHealthBadge Component
 *
 * Displays worker health status with color coding.
 * Green for healthy, yellow for warning, red for error.
 *
 * Requirements: 7.5
 */

'use client';

import type { Worker, WorkerHealth } from '../../domain/types';
import { deriveWorkerHealth } from '../../domain/types';

export interface WorkerHealthBadgeProps {
  worker: Worker;
  showLabel?: boolean;
}

/**
 * Get health indicator color classes
 */
function getHealthColorClasses(health: WorkerHealth): string {
  switch (health) {
    case 'healthy':
      return 'bg-green-500';
    case 'warning':
      return 'bg-yellow-500';
    case 'error':
      return 'bg-red-500';
    default:
      return 'bg-gray-400';
  }
}

/**
 * Get health label
 */
function getHealthLabel(health: WorkerHealth): string {
  switch (health) {
    case 'healthy':
      return 'Healthy';
    case 'warning':
      return 'Warning';
    case 'error':
      return 'Error';
    default:
      return 'Unknown';
  }
}

/**
 * WorkerHealthBadge component
 *
 * Displays a colored indicator for worker health status.
 */
export function WorkerHealthBadge({
  worker,
  showLabel = true,
}: WorkerHealthBadgeProps) {
  const health = worker.health ?? deriveWorkerHealth(worker);

  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-2.5 h-2.5 rounded-full ${getHealthColorClasses(health)}`}
        title={getHealthLabel(health)}
      />
      {showLabel && (
        <span className="text-sm text-muted-foreground">
          {getHealthLabel(health)}
        </span>
      )}
    </div>
  );
}
