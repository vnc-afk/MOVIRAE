"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

interface UsePaginatedApiOptions<T> {
  queryKey: readonly unknown[];
  pageLimit: number;
  fetchPage: (offset: number) => Promise<T[]>;
  enabled?: boolean;
}

/**
 * Generic hook for paginated API queries using React Query infinite loading.
 *
 * @param queryKey - Unique cache key for this paginated resource.
 * @param pageLimit - Number of items per page.
 * @param fetchPage - Function that loads a page by offset.
 * @param enabled - Controls whether the query should run.
 */
export function usePaginatedApi<T>({
  queryKey,
  pageLimit,
  fetchPage,
  enabled = true,
}: UsePaginatedApiOptions<T>) {
  return useInfiniteQuery<T[]>({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const offset = typeof pageParam === "number" ? pageParam : 0;
      return fetchPage(offset);
    },
    getNextPageParam: (lastPage, pages) => {
      // Fetch the next page only when the last page is full.
      return lastPage.length === pageLimit ? pages.flat().length : undefined;
    },
    initialPageParam: 0,
    enabled,
  });
}
