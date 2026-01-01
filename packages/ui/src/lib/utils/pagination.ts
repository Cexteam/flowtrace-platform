/**
 * Pagination Utility Functions
 *
 * Generic pagination utilities for tables and lists.
 *
 * Requirements: 2.4, 4.4, 6.4, 10.4, 13.4
 */

/**
 * Pagination result containing the paginated items and metadata
 */
export interface PaginationResult<T> {
  /** Items for the current page */
  items: T[];
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of items across all pages */
  totalCount: number;
  /** Total number of pages */
  totalPages: number;
}

/**
 * Default page sizes available for selection
 */
export const DEFAULT_PAGE_SIZES = [10, 25, 50, 100] as const;

/**
 * Calculate the total number of pages
 *
 * @param totalCount - Total number of items
 * @param pageSize - Number of items per page
 * @returns Total number of pages (minimum 1)
 *
 * Requirements: 2.4, 4.4, 6.4, 10.4, 13.4
 */
export function calculateTotalPages(
  totalCount: number,
  pageSize: number
): number {
  if (totalCount <= 0 || pageSize <= 0) {
    return 1;
  }
  return Math.ceil(totalCount / pageSize);
}

/**
 * Paginate an array of items
 *
 * Returns a slice of items for the specified page.
 * Page numbers are 1-indexed (first page is 1).
 *
 * @param items - Array of items to paginate
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of items per page
 * @returns Paginated items for the specified page
 *
 * Requirements: 2.4, 4.4, 6.4, 10.4, 13.4
 */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  // Handle edge cases
  if (items.length === 0 || pageSize <= 0) {
    return [];
  }

  // Normalize page to be at least 1
  const normalizedPage = Math.max(1, page);

  // Calculate start and end indices
  const startIndex = (normalizedPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  // Return empty array if start index is beyond items length
  if (startIndex >= items.length) {
    return [];
  }

  return items.slice(startIndex, endIndex);
}

/**
 * Paginate items and return full pagination result with metadata
 *
 * @param items - Array of items to paginate
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of items per page
 * @returns Pagination result with items and metadata
 */
export function paginateWithMetadata<T>(
  items: T[],
  page: number,
  pageSize: number
): PaginationResult<T> {
  const totalCount = items.length;
  const totalPages = calculateTotalPages(totalCount, pageSize);
  const normalizedPage = Math.max(1, Math.min(page, totalPages));
  const paginatedItems = paginate(items, normalizedPage, pageSize);

  return {
    items: paginatedItems,
    page: normalizedPage,
    pageSize,
    totalCount,
    totalPages,
  };
}

/**
 * Calculate the range of items being displayed
 *
 * @param page - Current page number (1-indexed)
 * @param pageSize - Number of items per page
 * @param totalCount - Total number of items
 * @returns Object with start and end item numbers (1-indexed)
 */
export function getDisplayRange(
  page: number,
  pageSize: number,
  totalCount: number
): { start: number; end: number } {
  if (totalCount === 0) {
    return { start: 0, end: 0 };
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  return { start, end };
}

/**
 * Check if there is a next page
 *
 * @param page - Current page number (1-indexed)
 * @param totalPages - Total number of pages
 * @returns True if there is a next page
 */
export function hasNextPage(page: number, totalPages: number): boolean {
  return page < totalPages;
}

/**
 * Check if there is a previous page
 *
 * @param page - Current page number (1-indexed)
 * @returns True if there is a previous page
 */
export function hasPreviousPage(page: number): boolean {
  return page > 1;
}
