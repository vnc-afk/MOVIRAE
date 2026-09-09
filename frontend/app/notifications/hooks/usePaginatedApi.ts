"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

interface UsePaginatedApiOptions<T> {
  queryKey: readonly unknown[];
  fetchPage: (cursor: string | null) => Promise<PaginatedPage<T>>;
  enabled?: boolean;
}

export interface PaginatedPage<T> {
  value: T[];
  nextCursor: string | null;
}

/**
 * Generic hook for paginated API queries using React Query infinite loading.
 *
 * @param queryKey - Unique cache key for this paginated resource.
 * @param pageLimit - Number of items per page.
 * @param fetchPage - Function that loads a page by cursor.
 * @param enabled - Controls whether the query should run.
 */
export function usePaginatedApi<T>({
  queryKey,
  fetchPage,
  enabled = true,
}: UsePaginatedApiOptions<T>) {
  return useInfiniteQuery<PaginatedPage<T>>({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const cursor = typeof pageParam === "string" ? pageParam : null;
      return fetchPage(cursor);
    },
    getNextPageParam: (lastPage) => {
      return lastPage.nextCursor ?? undefined;
    },
    initialPageParam: null,
    enabled,
  });
}
