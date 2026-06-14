"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RECOMMENDATIONS_CONFIG } from "../lib/constants";

interface UseRecommendationsPaginationOptions<T> {
  initialItems: T[];
  initialPage: number;
  fetchPage: (page: number) => Promise<T[]>;
  dedupe: (items: T[]) => T[];
  pageSize?: number;
}

interface UseRecommendationsPaginationResult<T> {
  items: T[];
  currentPage: number;
  hasMore: boolean;
  isFetching: boolean;
  loadNext: () => Promise<boolean>;
}

export function useRecommendationsPagination<T>({
  initialItems,
  initialPage,
  fetchPage,
  dedupe,
  pageSize = RECOMMENDATIONS_CONFIG.PAGE_SIZE,
}: UseRecommendationsPaginationOptions<T>): UseRecommendationsPaginationResult<T> {
  const [items, setItems] = useState(initialItems);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialItems.length >= pageSize);
  const [isFetching, setIsFetching] = useState(false);

  const currentPageRef = useRef(initialPage);
  const hasMoreRef = useRef(initialItems.length >= pageSize);
  const isFetchingRef = useRef(false);
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    currentPageRef.current = initialPage;
    hasMoreRef.current = initialItems.length >= pageSize;
    requestIdRef.current += 1;

    setItems(initialItems);
    setCurrentPage(initialPage);
    setHasMore(initialItems.length >= pageSize);
    setIsFetching(false);
  }, [initialItems, initialPage, pageSize]);

  const loadNext = useCallback(async () => {
    if (isFetchingRef.current || !hasMoreRef.current) {
      return false;
    }

    const requestId = ++requestIdRef.current;
    const nextPage = currentPageRef.current + 1;

    isFetchingRef.current = true;
    setIsFetching(true);

    try {
      const results = await fetchPage(nextPage);

      if (requestId !== requestIdRef.current || !isMountedRef.current) {
        // If this request is stale or the component unmounted, clear fetching state
        isFetchingRef.current = false;
        setIsFetching(false);
        return false;
      }

      if (results.length === 0) {
        hasMoreRef.current = false;
        setHasMore(false);
        return false;
      }

      const uniqueResults = dedupe(results);
      if (uniqueResults.length > 0) {
        setItems((previous) => [...previous, ...uniqueResults]);
      }

      currentPageRef.current = nextPage;
      setCurrentPage(nextPage);

      if (results.length < pageSize) {
        hasMoreRef.current = false;
        setHasMore(false);
      }

      return uniqueResults.length > 0;
    } catch (error) {
      console.error("Recommendations pagination failed:", error);
      return false;
    } finally {
      if (requestId === requestIdRef.current && isMountedRef.current) {
        isFetchingRef.current = false;
        setIsFetching(false);
      }
    }
  }, [dedupe, fetchPage, pageSize]);

  return {
    items,
    currentPage,
    hasMore,
    isFetching,
    loadNext,
  };
}
