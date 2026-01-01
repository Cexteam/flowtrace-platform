/**
 * Sorting Utility Functions
 *
 * Generic sorting utilities for tables and lists.
 * These functions are designed to work with any item type.
 *
 * Requirements: 2.5, 10.5
 */

/**
 * Sort order type
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Sort configuration
 */
export interface SortConfig<T> {
  column: keyof T;
  order: SortOrder;
}

/**
 * Get a nested value from an object using a dot-notation path
 *
 * @param obj - Object to get value from
 * @param path - Property path (can be nested with dots)
 * @returns The value at the path, or undefined if not found
 */
function getNestedValue<T>(obj: T, path: string): unknown {
  const keys = path.split('.');
  let value: unknown = obj;

  for (const key of keys) {
    if (value === null || value === undefined) {
      return undefined;
    }
    value = (value as Record<string, unknown>)[key];
  }

  return value;
}

/**
 * Compare two values for sorting
 *
 * Handles strings, numbers, booleans, and dates.
 * Null/undefined values are sorted to the end.
 *
 * @param a - First value
 * @param b - Second value
 * @param order - Sort order ('asc' or 'desc')
 * @returns Comparison result (-1, 0, or 1)
 */
function compareValues(a: unknown, b: unknown, order: SortOrder): number {
  // Handle null/undefined - always sort to end
  if (a === null || a === undefined) {
    return order === 'asc' ? 1 : -1;
  }
  if (b === null || b === undefined) {
    return order === 'asc' ? -1 : 1;
  }

  let comparison = 0;

  // String comparison (case-insensitive)
  if (typeof a === 'string' && typeof b === 'string') {
    comparison = a.toLowerCase().localeCompare(b.toLowerCase());
  }
  // Number comparison
  else if (typeof a === 'number' && typeof b === 'number') {
    comparison = a - b;
  }
  // Boolean comparison (true > false)
  else if (typeof a === 'boolean' && typeof b === 'boolean') {
    comparison = a === b ? 0 : a ? 1 : -1;
  }
  // Date comparison
  else if (a instanceof Date && b instanceof Date) {
    comparison = a.getTime() - b.getTime();
  }
  // Fallback: convert to string and compare
  else {
    comparison = String(a).localeCompare(String(b));
  }

  return order === 'desc' ? -comparison : comparison;
}

/**
 * Sort items by a specified column and order
 *
 * Creates a new sorted array without mutating the original.
 * Supports nested properties using dot notation (e.g., 'user.name').
 *
 * @param items - Array of items to sort
 * @param column - Column/property to sort by (supports dot notation for nested properties)
 * @param order - Sort order ('asc' or 'desc')
 * @returns New sorted array
 *
 * Requirements: 2.5, 10.5
 */
export function sortBy<T>(
  items: T[],
  column: keyof T | string,
  order: SortOrder = 'asc'
): T[] {
  // Return empty array as-is
  if (items.length === 0) {
    return [];
  }

  // Create a copy to avoid mutating the original
  return [...items].sort((a, b) => {
    const aValue = getNestedValue(a, String(column));
    const bValue = getNestedValue(b, String(column));
    return compareValues(aValue, bValue, order);
  });
}

/**
 * Sort items using a SortConfig object
 *
 * Convenience wrapper around sortBy that accepts a config object.
 *
 * @param items - Array of items to sort
 * @param config - Sort configuration with column and order
 * @returns New sorted array
 */
export function sortByConfig<T>(items: T[], config: SortConfig<T>): T[] {
  return sortBy(items, config.column, config.order);
}

/**
 * Create a comparator function for use with Array.sort()
 *
 * Useful when you need to pass a comparator to other sorting utilities.
 *
 * @param column - Column/property to sort by
 * @param order - Sort order ('asc' or 'desc')
 * @returns Comparator function
 */
export function createComparator<T>(
  column: keyof T | string,
  order: SortOrder = 'asc'
): (a: T, b: T) => number {
  return (a: T, b: T) => {
    const aValue = getNestedValue(a, String(column));
    const bValue = getNestedValue(b, String(column));
    return compareValues(aValue, bValue, order);
  };
}
