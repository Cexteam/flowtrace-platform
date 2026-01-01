/**
 * Filter Utility Functions
 *
 * Generic filtering utilities for tables and lists.
 * These functions are designed to work with any item type that has the required properties.
 *
 * Requirements: 2.2, 2.3
 */

/**
 * Searchable item interface - items must have at least one string property to search
 */
export interface SearchableItem {
  [key: string]: unknown;
}

/**
 * Item with status property
 */
export interface StatusItem {
  status: string;
}

/**
 * Filter items by search term (case-insensitive)
 *
 * Searches across specified fields or defaults to common searchable fields.
 * Returns all items if search term is empty or whitespace-only.
 *
 * @param items - Array of items to filter
 * @param searchTerm - Search term to match (case-insensitive)
 * @param searchFields - Optional array of field names to search in. Defaults to ['symbol', 'name', 'id']
 * @returns Filtered array containing only items that match the search term
 *
 * Requirements: 2.2, 10.2
 */
export function filterBySearch<T extends SearchableItem>(
  items: T[],
  searchTerm: string,
  searchFields: (keyof T)[] = ['symbol', 'name', 'id'] as (keyof T)[]
): T[] {
  const normalizedTerm = searchTerm.trim().toLowerCase();

  // Return all items if search term is empty
  if (!normalizedTerm) {
    return items;
  }

  return items.filter((item) => {
    return searchFields.some((field) => {
      const value = item[field];
      if (typeof value === 'string') {
        return value.toLowerCase().includes(normalizedTerm);
      }
      return false;
    });
  });
}

/**
 * Status filter options
 */
export type StatusFilterOption = 'all' | string;

/**
 * Filter items by status
 *
 * Returns all items if status is 'all' or empty.
 * Otherwise returns only items matching the specified status (case-insensitive).
 *
 * @param items - Array of items to filter
 * @param status - Status to filter by ('all' returns all items)
 * @returns Filtered array containing only items that match the status
 *
 * Requirements: 2.3
 */
export function filterByStatus<T extends StatusItem>(
  items: T[],
  status: StatusFilterOption
): T[] {
  const normalizedStatus = status.trim().toLowerCase();

  // Return all items if status is 'all' or empty
  if (!normalizedStatus || normalizedStatus === 'all') {
    return items;
  }

  return items.filter((item) => {
    return item.status.toLowerCase() === normalizedStatus;
  });
}

/**
 * Combined filter function for convenience
 *
 * Applies both search and status filters in sequence.
 *
 * @param items - Array of items to filter
 * @param searchTerm - Search term to match
 * @param status - Status to filter by
 * @param searchFields - Optional array of field names to search in
 * @returns Filtered array
 */
export function filterItems<T extends SearchableItem & StatusItem>(
  items: T[],
  searchTerm: string,
  status: StatusFilterOption,
  searchFields?: (keyof T)[]
): T[] {
  const searchFiltered = filterBySearch(items, searchTerm, searchFields);
  return filterByStatus(searchFiltered, status);
}
