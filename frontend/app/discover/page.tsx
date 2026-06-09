"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useFilterSync,
  useFilterUpdater,
  useDiscoverData,
  useMovieDedupe,
  usePagination,
  useFilterPresets,
} from "./hooks";
import {
  DiscoverHeader,
  SearchInput,
  PresetManager,
  GenreFilter,
  AdvancedFilters,
  SortSelector,
  MovieGrid,
  PaginationLoader,
  ClearFilters,
  ErrorBoundary,
  ErrorAlert,
} from "./components";
import {
  DEFAULT_FILTERS,
  filterByRuntime,
  sortMovies,
  countActiveFilters,
  deduplicateMovies,
} from "./lib/filterUtils";
import type { Movie } from "@/lib/types";
import type { FilterPreset } from "./lib/types";

/**
 * Smart Discover Page - Refactored
 *
 * Improvements:
 * - Comprehensive error handling with error boundary & error alerts
 * - Request cancellation via AbortController
 * - Input validation on URL filters
 * - Better edge case handling
 * - Accessibility improvements (ARIA labels, focus management)
 * - Network timeout support
 * - Type-safe filter utilities
 *
 * Feature-based architecture:
 * - hooks/: Business logic hooks (testable, reusable)
 * - components/: UI components (focused, single responsibility)
 * - lib/: Utilities, types, and error handling (pure functions)
 */
function DiscoverContent() {
  // Core state management
  const [filters, setFilters, filterError] = useFilterSync();
  const updateFilter = useFilterUpdater(filters, setFilters);

  // Data fetching
  const data = useDiscoverData(filters);
  const { genres, baseMovies, isDefaultMode } = data;
  const { fetchPage, invalidateCache } = data;

  // Pagination
  const pagination = usePagination();
  const { hasMore, isFetching, error: paginationError } = pagination;
  const { reset: resetPagination, loadNext } = pagination;

  // Deduplication
  const {
    deduplicate,
    reset: resetDedupe,
  } = useMovieDedupe();

  // Presets
  const presets = useFilterPresets();

  // UI state
  const [pageMovies, setPageMovies] = useState<Movie[][]>([]);
  const [dismissedErrors, setDismissedErrors] = useState<Set<string>>(new Set());

  // ========== Compute derived state ==========

  const trimmedQuery = filters.query.trim();
  const isLoading = isDefaultMode && baseMovies.length === 0 && pageMovies.length === 0;

  // Keep pagination append-only: never globally re-sort newly fetched pages
  // above cards the user has already scrolled past.
  const visiblePages = useMemo(() => {
    const pages = isDefaultMode ? [baseMovies, ...pageMovies] : pageMovies;

    return pages
      .map((page) => sortMovies(filterByRuntime(page, filters.runtimeRange), filters.sortBy))
      .filter((page) => page.length > 0);
  }, [baseMovies, filters.runtimeRange, filters.sortBy, isDefaultMode, pageMovies]);

  const uniqueMovies = useMemo(
    () => deduplicateMovies(visiblePages.flat()),
    [visiblePages]
  );

  // Calculate active filters
  const activeFilterCount = countActiveFilters(filters);

  // Collect all errors
  const allErrors = [filterError, data.error, paginationError, presets.error].filter(
    Boolean
  );
  const visibleErrors = allErrors.filter((err) => !dismissedErrors.has(err?.message || ""));

  // ========== Callbacks ==========

  /**
   * Handle preset application
   */
  const applyPreset = useCallback((preset: FilterPreset) => {
    setFilters({
      ...DEFAULT_FILTERS,
      genreId: preset.filters.genreId || "",
      runtimeRange: [
        preset.filters.minRuntime || 0,
        preset.filters.maxRuntime || 200,
      ],
    });
  }, [setFilters]);

  /**
   * Reset filters to defaults
   */
  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, [setFilters]);

  /**
   * Reset pagination when filters change
   */
  useEffect(() => {
    resetPagination();
    setPageMovies([]);
    resetDedupe();
    invalidateCache();
  }, [trimmedQuery, filters.genreId, resetPagination, resetDedupe, invalidateCache]);

  /**
   * Load first page when entering search/genre mode
   */
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
        console.error("Failed to load first page:", err);
        // Error is handled by pagination state
      }
    };

    loadFirstPage();
  }, [isDefaultMode, fetchPage, resetPagination, resetDedupe, deduplicate]);

  /**
   * Handle loading next page with proper error handling
   */
  const handleLoadNext = useCallback(() => {
    if (isFetching || !hasMore) return;

    loadNext(async (page) => {
      try {
        const { movies, pageSize: apiPageSize } = await fetchPage(page);
        const unique = deduplicate(movies || []);

        if (unique.length > 0) {
          setPageMovies((prev) => [...prev, unique]);
        }

        return {
          results: unique,
          pageSize: apiPageSize,
        };
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
    
    // Dismiss the error and let user interact
    handleDismissError(error.message);
    
    // Attempt to reload relevant data based on error type
    if (presets.error === error) {
      presets.reload();
    }
  }, [presets, handleDismissError]);

  // ========== Render ==========

  return (
    <div className="pb-20 md:pb-0">
      <div className="container py-8 space-y-6">
        {/* Error alerts */}
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

        {/* Header */}
        <DiscoverHeader />

        {/* Presets */}
        <PresetManager
          presets={presets.presets}
          isLoading={presets.isLoading}
          onApply={applyPreset}
          onSave={presets.save}
          currentFilters={filters}
        />

        {/* Search */}
        <SearchInput 
          value={filters.query} 
          onChange={(q) => updateFilter("query", q)}
          disabled={isLoading}
        />

        {/* Genre Filter */}
        <GenreFilter
          genres={genres}
          selectedGenreId={filters.genreId}
          onGenreChange={(genreId) => updateFilter("genreId", genreId)}
        />

        {/* Advanced Filters */}
        <AdvancedFilters
          runtimeRange={filters.runtimeRange}
          onRuntimeChange={(range) => updateFilter("runtimeRange", range)}
        />

        {/* Clear & Sort Controls */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <ClearFilters
            activeCount={activeFilterCount}
            movieCount={uniqueMovies.length}
            onClear={clearAllFilters}
            isLoading={isLoading}
          />
          <SortSelector
            value={filters.sortBy}
            onChange={(sortBy) => updateFilter("sortBy", sortBy)}
            disabled={isLoading}
          />
        </div>

        {/* Movie Grid */}
        <MovieGrid movies={uniqueMovies} isLoading={isLoading} />

        {/* Pagination */}
        {!isLoading && uniqueMovies.length > 0 && (
          <PaginationLoader
            isLoading={isFetching}
            hasMore={hasMore}
            onLoadMore={handleLoadNext}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Main Discover page component wrapped with error boundary
 */
export default function Discover() {
  return (
    <ErrorBoundary>
      <DiscoverContent />
    </ErrorBoundary>
  );
}
