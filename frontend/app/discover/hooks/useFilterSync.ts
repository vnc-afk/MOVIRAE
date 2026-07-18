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
import { ValidationError, normalizeError } from "../lib/errors";
import { TIMING_CONFIG } from "../lib/constants";

/**
 * Synchronizes discover filters between internal state and the browser URL.
 *
 * The hook reads filter state from the URL on load and writes updates back with debouncing.
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
      // Update state when the URL changes, while avoiding redundant updates.
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
 * Produces a callback for updating a specific filter field.
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