"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PaginationState } from "../lib/types";
import { PAGINATION_CONFIG } from "../lib/constants";

type PageFetcher = (
  page: number
) => Promise<{ results: any[]; pageSize: number }>;

/**
 * Provides pagination state and load-next behavior for infinite scroll.
 */
export function usePagination() {
  const [currentPage, setCurrentPage] = useState<number>(
    PAGINATION_CONFIG.INITIAL_PAGE
  );
  const [hasMore, setHasMore] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const currentPageRef = useRef<number>(PAGINATION_CONFIG.INITIAL_PAGE);
  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const lastPageSizeRef = useRef<number | null>(null);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    isFetchingRef.current = isFetching;
  }, [isFetching]);

  const reset = useCallback(() => {
    requestGenerationRef.current += 1;
    // Invalidate any in-flight page requests when pagination state resets.
    currentPageRef.current = PAGINATION_CONFIG.INITIAL_PAGE;
    hasMoreRef.current = true;
    isFetchingRef.current = false;
    lastPageSizeRef.current = null;

    setCurrentPage(PAGINATION_CONFIG.INITIAL_PAGE);
    setHasMore(true);
    setIsFetching(false);
    setError(null);
  }, []);

const loadNext = useCallback(async (fetcher: PageFetcher) => {
  if (isFetchingRef.current || !hasMoreRef.current) return;

  const generation = requestGenerationRef.current;
  const nextPage = currentPageRef.current + 1;

  isFetchingRef.current = true;
  setIsFetching(true);
  setError(null);

  try {
    const { results, pageSize } = await fetcher(nextPage);

    if (generation !== requestGenerationRef.current) {
      return;
    }

    if (!pageSize || pageSize === 0) {
      hasMoreRef.current = false;
      setHasMore(false);
      return;
    }

    lastPageSizeRef.current = pageSize;
    currentPageRef.current = nextPage;
    setCurrentPage(nextPage);

    const minResultsThreshold = Math.max(
      1,
      Math.floor(pageSize * PAGINATION_CONFIG.DEDUPLICATION_THRESHOLD)
    );

    if (results.length < minResultsThreshold) {
      hasMoreRef.current = false;
      setHasMore(false);
    }
  } catch (err) {
    if (generation !== requestGenerationRef.current) {
      return;
    }

    if (err instanceof DOMException && err.name === "AbortError") {
      return;
    }

    const nextError = err instanceof Error ? err : new Error(String(err));
    setError(nextError);
    console.error("Failed to load next page:", nextError);
  } finally {
    if (generation === requestGenerationRef.current) {
      isFetchingRef.current = false;
      setIsFetching(false);
    }
  }
}, []);

  const state: PaginationState = {
    currentPage,
    hasMore,
    isFetching,
  };

  return {
    ...state,
    error,
    reset,
    loadNext,
  };
}
