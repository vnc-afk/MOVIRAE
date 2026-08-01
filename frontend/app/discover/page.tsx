"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useFilterSync,
  useFilterUpdater,
  useDiscoverData,
  useMovieDedupe,
  usePagination,
  useFilterPresets,
  useDebouncedValue, 
} from "./hooks";
import {
  DiscoverHeader, SearchInput, PresetManager, GenreFilter, AdvancedFilters,
  SortSelector, MovieGrid, PaginationLoader, ClearFilters, ErrorBoundary, ErrorAlert,
} from "./components";
import {
  DEFAULT_FILTERS, filterByRuntime, sortMovies, countActiveFilters, deduplicateMovies,
} from "./lib/filterUtils";
import { TIMING_CONFIG } from "./lib/constants"; 
import type { Movie } from "@/lib/types";
import type { FilterPreset } from "./lib/types";
import type { FilterState } from "./lib/types";

function DiscoverContent() {
  // Sync discover filters with the URL search params and keep an in-memory state copy.
  // This enables the page to preserve state across refreshes and shareable URLs.
  const [filters, setFilters, filterError] = useFilterSync();
  const updateFilter = useFilterUpdater(setFilters);

  const handleQueryChange = useCallback((q: string) => updateFilter("query", q), [updateFilter]);
  const handleGenreChange = useCallback((genreId: string) => updateFilter("genreId", genreId), [updateFilter]);
  const handleRuntimeChange = useCallback(
    (range: [number, number]) => updateFilter("runtimeRange", range),
    [updateFilter]
  );
  const handleSortChange = useCallback(
    (sortBy: FilterState["sortBy"]) => updateFilter("sortBy", sortBy),
    [updateFilter]
  );

    const filtersRef = useRef(filters);
    useEffect(() => {
      filtersRef.current = filters;
    }, [filters]);

    const getCurrentFilters = useCallback(() => filtersRef.current, []);

  const debouncedQuery = useDebouncedValue(filters.query, TIMING_CONFIG.SEARCH_DEBOUNCE_MS);
  const debouncedFilters = useMemo(
    () => ({ query: debouncedQuery, genreId: filters.genreId, runtimeRange: filters.runtimeRange, sortBy: filters.sortBy }),
    [debouncedQuery, filters.genreId, filters.runtimeRange, filters.sortBy]
  );

  // Data hook handles genres, default trending seeds, and page-based search/genre fetches.
  const data = useDiscoverData(debouncedFilters);
  const { genres, baseMovies, isDefaultMode } = data;
  const { fetchPage, invalidateCache } = data;

  const pagination = usePagination();
  const { hasMore, isFetching, error: paginationError } = pagination;
  const { reset: resetPagination, loadNext } = pagination;

  const { deduplicate, reset: resetDedupe } = useMovieDedupe();
  const presets = useFilterPresets();

  const [pageMovies, setPageMovies] = useState<Movie[][]>([]);
  const [dismissedErrors, setDismissedErrors] = useState<Set<string>>(new Set());

  const trimmedQuery = debouncedQuery.trim();
  const isLoading = isDefaultMode && baseMovies.length === 0 && pageMovies.length === 0;

  // Build the visible movie pages from the current mode, applying runtime and sort filters.
  const visiblePages = useMemo(() => {
    const pages = isDefaultMode ? [baseMovies, ...pageMovies] : pageMovies;

    // Apply runtime filtering and current sort order to the visible page list.
    return pages
      .map((page) => sortMovies(filterByRuntime(page, filters.runtimeRange), filters.sortBy))
      .filter((page) => page.length > 0);
  }, [baseMovies, filters.runtimeRange, filters.sortBy, isDefaultMode, pageMovies]);

  const uniqueMovies = useMemo(() => deduplicateMovies(visiblePages.flat()), [visiblePages]);
  const activeFilterCount = countActiveFilters(filters);

  const allErrors = [filterError, data.error, paginationError, presets.error].filter(Boolean);
  const visibleErrors = allErrors.filter((err) => !dismissedErrors.has(err?.message || ""));

  const applyPreset = useCallback((preset: FilterPreset) => {
    setFilters({
      ...DEFAULT_FILTERS,
      genreId: preset.filters.genreId || "",
      runtimeRange: [preset.filters.minRuntime || 0, preset.filters.maxRuntime || 200],
    });
  }, [setFilters]);

  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, [setFilters]);

  useEffect(() => {
    // Whenever the query or selected genre changes, clear stale paginated data
    // and revalidate discover seeds so the next page load starts fresh.
    resetPagination();
    setPageMovies([]);
    resetDedupe();
    invalidateCache();
  }, [trimmedQuery, filters.genreId, resetPagination, resetDedupe, invalidateCache]);

  useEffect(() => {
    if (isDefaultMode) return;

    const loadFirstPage = async () => {
      resetPagination();
      setPageMovies([]);
      resetDedupe();

      try {
        const { movies } = await fetchPage(1);
        if (movies && movies.length > 0) {
          const unique = deduplicate(movies);
          setPageMovies([unique]);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error("Failed to load first page:", err);
      }
    };

    loadFirstPage();
  }, [isDefaultMode, fetchPage, resetPagination, resetDedupe, deduplicate]);

  const handleLoadNext = useCallback(() => {
    if (isFetching || !hasMore) return;

    loadNext(async (page) => {
      try {
        const { movies, pageSize: apiPageSize } = await fetchPage(page);
        const unique = deduplicate(movies || []);

        if (unique.length > 0) {
          setPageMovies((prev) => [...prev, unique]);
        }

        return { results: unique, pageSize: apiPageSize };
      } catch (err) {
        console.error("Failed to load page:", page, err);
        throw err;
      }
    });
  }, [isFetching, hasMore, loadNext, fetchPage, deduplicate]);

  const handleDismissError = useCallback((errorMessage: string) => {
    setDismissedErrors((prev) => new Set([...prev, errorMessage]));
  }, []);

  const handleRetryError = useCallback((error: Error | null) => {
    if (!error) return;
    handleDismissError(error.message);
    if (presets.error === error) {
      presets.reload();
    }
  }, [presets, handleDismissError]);

  return (
    <div className="pb-20 md:pb-0">
      <div className="container py-8 space-y-6">
        {visibleErrors.length > 0 && (
          <div className="space-y-2" role="region" aria-label="Errors" aria-live="polite">
            {visibleErrors.map((error, idx) => (
              <ErrorAlert
                key={idx}
                error={error}
                onDismiss={() => handleDismissError(error?.message || "")}
                retryable={[presets.error].includes(error)}
                onRetry={() => handleRetryError(error)}
              />
            ))}
          </div>
        )}

        <DiscoverHeader />

        <PresetManager
          presets={presets.presets}
          isLoading={presets.isLoading}
          onApply={applyPreset}
          onSave={presets.save}
          getCurrentFilters={getCurrentFilters}   
        />

        <SearchInput
          value={filters.query}
          onChange={handleQueryChange}
          disabled={isLoading}
        />

        <GenreFilter
          genres={genres}
          selectedGenreId={filters.genreId}
          onGenreChange={handleGenreChange}
        />

        <AdvancedFilters
          runtimeRange={filters.runtimeRange}
          onRuntimeChange={handleRuntimeChange}
        />

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <ClearFilters
            activeCount={activeFilterCount}
            movieCount={uniqueMovies.length}
            onClear={clearAllFilters}
            isLoading={isLoading}
          />
          <SortSelector
            value={filters.sortBy}
            onChange={handleSortChange}
            disabled={isLoading}
          />
        </div>

        <MovieGrid movies={uniqueMovies} isLoading={isLoading} />

        {!isLoading && uniqueMovies.length > 0 && (
          <PaginationLoader isLoading={isFetching} hasMore={hasMore} onLoadMore={handleLoadNext} />
        )}
      </div>
    </div>
  );
}

export default function Discover() {
  return (
    <ErrorBoundary>
      <DiscoverContent />
    </ErrorBoundary>
  );
}