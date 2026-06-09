"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

interface UsePaginatedApiOptions<T> {
  queryKey: readonly unknown[];
  pageLimit: number;
  fetchPage: (offset: number) => Promise<T[]>;
  enabled?: boolean;
}

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
      return lastPage.length === pageLimit ? pages.flat().length : undefined;
    },
    initialPageParam: 0,
    enabled,
  });
}
