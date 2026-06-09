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
 * Hook: Synchronize filter state with URL search params
 *
 * Responsibilities:
 * - Read filters from URL on mount and when URL changes
 * - Update URL when filters change (with debounce)
 * - Prevent unnecessary re-renders with equality checks
 * - Validate filter parameters from URL
 *
 * Usage:
 *   const [filters, setFilters, error] = useFilterSync();
 *   if (error) { /* show error UI * / }
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

  // Sync URL to state when search params change (browser back/forward)
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
      // Fall back to defaults if URL is malformed
      setFilters(DEFAULT_FILTERS);
      console.error("Invalid filter parameters in URL:", error);
    }
  }, [searchParams]);

  // Sync state to URL when filters change (with debounce to avoid thrashing)
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      try {
        const nextUrl = buildFiltersUrl(pathname, filters);
        const currentSearch = searchParams.toString();
        const currentUrl = currentSearch ? `${pathname}?${currentSearch}` : pathname;

        if (currentUrl !== nextUrl) {
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
 * Helper: Update a single filter field with type safety
 */
export function useFilterUpdater(
  filters: FilterState,
  setFilters: (filters: FilterState) => void
) {
  return useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      try {
        setFilters({ ...filters, [key]: value });
      } catch (err) {
        const error = normalizeError(err);
        console.error("Failed to update filter:", key, error);
        throw error;
      }
    },
    [filters, setFilters]
  );
}