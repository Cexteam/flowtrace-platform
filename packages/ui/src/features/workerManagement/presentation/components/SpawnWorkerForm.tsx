/**
 * SpawnWorkerForm Component
 *
 * Dialog for spawning new workers with configuration.
 * Allows selecting number of workers to spawn.
 * Note: Current backend doesn't support manual spawn - shows info message.
 *
 * Requirements: 8.1, 8.2
 */

'use client';

import { useState, useCallback, FormEvent } from 'react';
import { useSpawnWorker } from '../hooks/useSpawnWorker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { DEFAULT_SPAWN_CONFIG, WorkerSpawnConfig } from '../../domain/types';

/**
 * Form validation errors
 */
interface FormErrors {
  workerCount?: string;
  maxSymbols?: string;
  memoryLimitMB?: string;
  cpuThreshold?: string;
}

/**
 * Validate spawn configuration
 */
function validateConfig(
  config: WorkerSpawnConfig,
  workerCount: number
): FormErrors {
  const errors: FormErrors = {};

  if (workerCount < 1 || workerCount > 10) {
    errors.workerCount = 'Number of workers must be between 1 and 10';
  }

  if (config.maxSymbols < 1 || config.maxSymbols > 500) {
    errors.maxSymbols = 'Max symbols must be between 1 and 500';
  }

  if (config.memoryLimitMB < 128 || config.memoryLimitMB > 4096) {
    errors.memoryLimitMB = 'Memory limit must be between 128 MB and 4096 MB';
  }

  if (config.cpuThreshold < 10 || config.cpuThreshold > 100) {
    errors.cpuThreshold = 'CPU threshold must be between 10% and 100%';
  }

  return errors;
}

/**
 * Input field component
 */
interface InputFieldProps {
  label: string;
  name: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  error?: string;
  disabled?: boolean;
  description?: string;
}

function InputField({
  label,
  name,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  error,
  disabled,
  description,
}: InputFieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
        {unit && <span className="text-muted-foreground ml-1">({unit})</span>}
      </label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <input
        type="number"
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={`w-full px-3 py-2 rounded-md border bg-background text-foreground
          ${error ? 'border-destructive' : 'border-input'}
          focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed`}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/**
 * Info banner component
 */
function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
      <svg
        className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <div className="text-sm text-blue-700 dark:text-blue-300">{children}</div>
    </div>
  );
}

/**
 * SpawnWorkerForm component props
 */
interface SpawnWorkerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (workerId: string) => void;
}

/**
 * SpawnWorkerForm component
 *
 * Dialog for configuring and spawning new workers.
 * Requirements: 8.1, 8.2
 */
export function SpawnWorkerForm({
  open,
  onOpenChange,
  onSuccess,
}: SpawnWorkerFormProps) {
  const [workerCount, setWorkerCount] = useState(1);
  const [config, setConfig] = useState<WorkerSpawnConfig>({
    ...DEFAULT_SPAWN_CONFIG,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const {
    spawning,
    result,
    error: spawnError,
    spawnWorker,
    reset,
  } = useSpawnWorker();

  const handleChange = useCallback(
    (field: keyof WorkerSpawnConfig) => (value: number) => {
      setConfig((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    []
  );

  const handleWorkerCountChange = useCallback((value: number) => {
    setWorkerCount(value);
    setErrors((prev) => ({ ...prev, workerCount: undefined }));
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      // Validate
      const validationErrors = validateConfig(config, workerCount);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      // Spawn workers (one at a time for now)
      // Note: Backend may not support spawning multiple workers in one request
      for (let i = 0; i < workerCount; i++) {
        const spawnResult = await spawnWorker(config);
        if (spawnResult?.success && spawnResult.workerId && i === 0) {
          onSuccess?.(spawnResult.workerId);
        }
      }
    },
    [config, workerCount, spawnWorker, onSuccess]
  );

  const handleClose = useCallback(() => {
    setWorkerCount(1);
    setConfig({ ...DEFAULT_SPAWN_CONFIG });
    setErrors({});
    reset();
    onOpenChange(false);
  }, [reset, onOpenChange]);

  // Show success state
  if (result?.success) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-green-600 dark:text-green-400">
              Worker Spawned Successfully
            </DialogTitle>
            <DialogDescription>
              Worker ID: <span className="font-mono">{result.workerId}</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleClose} variant="outline">
              Close
            </Button>
            <Button
              onClick={() => {
                reset();
                setWorkerCount(1);
              }}
            >
              Spawn Another
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Spawn New Workers</DialogTitle>
          <DialogDescription>
            Configure and spawn new worker processes
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {/* Info message about backend support */}
            <InfoBanner>
              <strong>Note:</strong> Manual worker spawning is currently
              limited. Workers are typically managed automatically by the system
              based on load. This feature may have limited functionality.
            </InfoBanner>

            {/* Number of workers - Requirements 8.1, 8.2 */}
            <InputField
              label="Number of Workers"
              name="workerCount"
              value={workerCount}
              onChange={handleWorkerCountChange}
              min={1}
              max={10}
              error={errors.workerCount}
              disabled={spawning}
              description="Select how many worker processes to spawn"
            />

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-4">Worker Configuration</h4>

              <div className="space-y-4">
                <InputField
                  label="Max Symbols per Worker"
                  name="maxSymbols"
                  value={config.maxSymbols}
                  onChange={handleChange('maxSymbols')}
                  min={1}
                  max={500}
                  error={errors.maxSymbols}
                  disabled={spawning}
                />

                <InputField
                  label="Memory Limit"
                  name="memoryLimitMB"
                  value={config.memoryLimitMB}
                  onChange={handleChange('memoryLimitMB')}
                  min={128}
                  max={4096}
                  step={64}
                  unit="MB"
                  error={errors.memoryLimitMB}
                  disabled={spawning}
                />

                <InputField
                  label="CPU Threshold"
                  name="cpuThreshold"
                  value={config.cpuThreshold}
                  onChange={handleChange('cpuThreshold')}
                  min={10}
                  max={100}
                  unit="%"
                  error={errors.cpuThreshold}
                  disabled={spawning}
                />
              </div>
            </div>

            {spawnError && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {spawnError}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              disabled={spawning}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={spawning}>
              {spawning
                ? 'Spawning...'
                : `Spawn ${workerCount} Worker${workerCount > 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Legacy SpawnWorkerForm for backward compatibility
 * Used when not in dialog mode
 */
export interface LegacySpawnWorkerFormProps {
  onSuccess?: (workerId: string) => void;
  onCancel?: () => void;
}

export function LegacySpawnWorkerForm({
  onSuccess,
  onCancel,
}: LegacySpawnWorkerFormProps) {
  const [isOpen, setIsOpen] = useState(true);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      onCancel?.();
    }
  };

  return (
    <SpawnWorkerForm
      open={isOpen}
      onOpenChange={handleOpenChange}
      onSuccess={onSuccess}
    />
  );
}
