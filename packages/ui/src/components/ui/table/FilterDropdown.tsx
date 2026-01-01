'use client';

import * as React from 'react';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDropdownProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  className?: string;
}

export function FilterDropdown({
  label,
  value,
  options,
  onChange,
  className = '',
}: FilterDropdownProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className="text-sm text-muted-foreground whitespace-nowrap">
        {label}:
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export interface MultiFilterDropdownProps {
  filters: {
    id: string;
    label: string;
    value: string;
    options: FilterOption[];
  }[];
  onChange: (filterId: string, value: string) => void;
  className?: string;
}

export function MultiFilterDropdown({
  filters,
  onChange,
  className = '',
}: MultiFilterDropdownProps) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {filters.map((filter) => (
        <FilterDropdown
          key={filter.id}
          label={filter.label}
          value={filter.value}
          options={filter.options}
          onChange={(value) => onChange(filter.id, value)}
        />
      ))}
    </div>
  );
}
