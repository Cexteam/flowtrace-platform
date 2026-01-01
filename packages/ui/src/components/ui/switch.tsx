/**
 * Switch Component
 *
 * A toggle switch component for on/off states.
 */

'use client';

import * as React from 'react';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/**
 * Switch component
 *
 * A toggle switch for boolean states.
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  className = '',
  id,
}: SwitchProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      onCheckedChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!disabled) {
        onCheckedChange(!checked);
      }
    }
  };

  const baseClasses =
    'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
  const checkedClasses = checked ? 'bg-primary' : 'bg-input';
  const disabledClasses = disabled ? 'cursor-not-allowed opacity-50' : '';

  const thumbBaseClasses =
    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out';
  const thumbPositionClasses = checked ? 'translate-x-5' : 'translate-x-0';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`${baseClasses} ${checkedClasses} ${disabledClasses} ${className}`}
    >
      <span className={`${thumbBaseClasses} ${thumbPositionClasses}`} />
    </button>
  );
}
