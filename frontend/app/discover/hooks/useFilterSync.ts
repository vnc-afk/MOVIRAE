"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type FilterState,
  DEFAULT_FILTERS,
  readFiltersFromSearchParams,
  buildFiltersUrl,
  areFiltersEqual,
} from "../lib/filterUtils";
import { normalizeError } from "../lib/errors";
import { TIMING_CONFIG } from "../lib/constants";

/**
 * Keeps the discover filter state synchronized with the URL so deep links and refreshes preserve the current view.
 */
export function useFilterSync() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<FilterState>(() => {
    try {
      return readFiltersFromSearchParams(searchParams);
    } catch (err) {
      console.error("Failed to parse URL filters:", err);
      return DEFAULT_FILTERS;
    }
  });

  const [error, setError] = useState<Error | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    try {
      const nextFilters = readFiltersFromSearchParams(searchParams);
      setFilters((current: FilterState) =>
        areFiltersEqual(current, nextFilters) ? current : nextFilters
      );
      setError(null);
    } catch (err) {
      const error = normalizeError(err);
      setError(error);

      setFilters(DEFAULT_FILTERS);
      console.error("Invalid filter parameters in URL:", error);
    }
  }, [searchParams]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce URL writes so filter changes do not trigger a replace on every keystroke.

    debounceTimerRef.current = setTimeout(() => {
      try {
        const nextUrl = buildFiltersUrl(pathname, filters);
        const currentSearch = searchParams.toString();
        const currentUrl = currentSearch ? `${pathname}?${currentSearch}` : pathname;

        if (nextUrl !== currentUrl) {
          router.replace(nextUrl, { scroll: false });
        }
      } catch (err) {
        const error = normalizeError(err);
        setError(error);
        console.error("Failed to update URL with filters:", error);
      }
    }, TIMING_CONFIG.URL_SYNC_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [filters, pathname, router, searchParams]);

  return [filters, setFilters, error] as const;
}

/**
 * Returns a typed updater helper that applies a single discover filter field without exposing the full setter contract.
 */
export function useFilterUpdater(
  setFilters: (updater: FilterState | ((current: FilterState) => FilterState)) => void
) {
  return useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      try {
        setFilters((current) => ({ ...current, [key]: value }));
      } catch (err) {
        const error = normalizeError(err);
        console.error("Failed to update filter:", key, error);
        throw error;
      }
    },
    [setFilters]
  );
}