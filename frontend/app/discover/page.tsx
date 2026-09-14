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
  DiscoverHeader, SearchInput, PresetManager, GenreFilter, MetadataChipFilter, AdvancedFilters,
  SortSelector, MovieGrid, PaginationLoader, ClearFilters, ErrorBoundary, ErrorAlert,
} from "./components";
import {
  DEFAULT_FILTERS, filterByRuntime, sortMovies, countActiveFilters, deduplicateMovies,
} from "./lib/filterUtils";
import { TIMING_CONFIG } from "./lib/constants"; 
import type { Movie } from "@/lib/types";
import type { FilterPreset } from "./lib/types";
import type { FilterState } from "./lib/types";

/**
 * Hosts the discover-page state orchestration and coordinates filters, pagination, and result rendering.
 */
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
  const handleToggleFilterArray = useCallback(
    <K extends "moods" | "tags" | "languages" | "countries">(
      key: K,
      value: string
    ) => {
      setFilters((current) => {
        const selected = current[key] ?? [];
        const next = selected.includes(value)
          ? selected.filter((entry) => entry !== value)
          : [...selected, value];
        return { ...current, [key]: next };
      });
    },
    [setFilters]
  );

    const filtersRef = useRef(filters);
    useEffect(() => {
      filtersRef.current = filters;
    }, [filters]);

    const getCurrentFilters = useCallback(() => filtersRef.current, []);

  const debouncedQuery = useDebouncedValue(filters.query, TIMING_CONFIG.SEARCH_DEBOUNCE_MS);
  const debouncedFilters = useMemo(
    () => ({
      query: debouncedQuery,
      genreId: filters.genreId,
      runtimeRange: filters.runtimeRange,
      sortBy: filters.sortBy,
      moods: filters.moods,
      tags: filters.tags,
      languages: filters.languages,
      countries: filters.countries,
    }),
    [debouncedQuery, filters.genreId, filters.moods, filters.runtimeRange, filters.sortBy, filters.tags, filters.languages, filters.countries]
  );

  // Data hook handles genres, default trending seeds, and page-based search/genre fetches.
  const data = useDiscoverData(debouncedFilters);
  const { genres, metadata, baseMovies, isDefaultMode } = data;
  const { fetchPage, invalidateCache } = data;

  const pagination = usePagination();
  const { hasMore, isFetching, error: paginationError } = pagination;
  const { reset: resetPagination, loadNext } = pagination;

  const { deduplicate, reset: resetDedupe } = useMovieDedupe();
  const presets = useFilterPresets();

  const [pageMovies, setPageMovies] = useState<Movie[][]>([]);
  const [dismissedErrors, setDismissedErrors] = useState<Set<string>>(new Set());
  const [isHydrating, setIsHydrating] = useState(true);

  const trimmedQuery = debouncedQuery.trim();
  const isLoading = isHydrating && (isDefaultMode ? baseMovies.length === 0 : pageMovies.length === 0);
  const shouldDisableControls = isDefaultMode && isLoading;
  const clientFilterKey = JSON.stringify({
    runtimeRange: filters.runtimeRange,
    moods: filters.moods,
    tags: filters.tags,
    languages: filters.languages,
    countries: filters.countries,
  });
  const hasClientFilters =
    filters.runtimeRange[0] !== DEFAULT_FILTERS.runtimeRange[0] ||
    filters.runtimeRange[1] !== DEFAULT_FILTERS.runtimeRange[1] ||
    filters.moods.length > 0 ||
    filters.tags.length > 0 ||
    filters.languages.length > 0 ||
    filters.countries.length > 0;

  // Build the visible movie pages from the  current mode, applying runtime and sort filters.
  const visiblePages = useMemo(() => {
    const pages = isDefaultMode ? [baseMovies, ...pageMovies] : pageMovies;

    return pages
      .map((page) => {
        const runtimeFiltered = filterByRuntime(page, filters.runtimeRange);
        const advancedFiltered = runtimeFiltered.filter((movie) => {
          const selectedMoods = filters.moods;
          const selectedTags = filters.tags;
          const selectedLanguages = filters.languages;
          const selectedCountries = filters.countries;

          const moodMatch =
            selectedMoods.length === 0 ||
            selectedMoods.some((entry) =>
              movie.moods?.some((mood) => mood.toLowerCase() === entry.toLowerCase())
            );

          const tagMatch =
            selectedTags.length === 0 ||
            selectedTags.some((entry) =>
              movie.tags?.some((tag) => tag.replace(/^#/, "").toLowerCase() === entry.replace(/^#/, "").toLowerCase())
            );

          const languageMatch =
            selectedLanguages.length === 0 ||
            selectedLanguages.some((entry) =>
              movie.language?.toLowerCase() === entry.toLowerCase()
            );

          const countryMatch =
            selectedCountries.length === 0 ||
            selectedCountries.some((entry) => {
              const normalizedEntry = entry.toLowerCase();
              const normalizedCountry = movie.country?.toLowerCase();
              const countryAliases: Record<string, string[]> = {
                usa: ["us", "usa"],
                uk: ["gb", "uk"],
                japan: ["jp", "japan"],
                australia: ["au", "australia"],
                france: ["fr", "france"],
                "south korea": ["kr", "south korea", "korea"],
              };
              const aliases = countryAliases[normalizedEntry] ?? [normalizedEntry];
              return aliases.includes(normalizedCountry ?? "");
            });

          return moodMatch && tagMatch && languageMatch && countryMatch;
        });

        return sortMovies(advancedFiltered, filters.sortBy);
      })
      .filter((page) => page.length > 0);
  }, [baseMovies, filters, isDefaultMode, pageMovies]);

  const uniqueMovies = useMemo(() => deduplicateMovies(visiblePages.flat()), [visiblePages]);
  const activeFilterCount = countActiveFilters(filters);

  const allErrors = [filterError, data.error, paginationError, presets.error].filter(Boolean);
  const visibleErrors = allErrors.filter((err) => !dismissedErrors.has(err?.message || ""));

  const applyPreset = useCallback((preset: FilterPreset) => {
    setFilters({
      ...DEFAULT_FILTERS,
      genreId: preset.filters.genreId || "",
      runtimeRange: [preset.filters.minRuntime || 0, preset.filters.maxRuntime || 200],
      moods: preset.filters.moods || [],
      tags: preset.filters.tags || [],
      languages: preset.filters.languages || [],
      countries: preset.filters.countries || [],
    });
  }, [setFilters]);

  const clearAllFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS, query: filters.query });
  }, [filters.query, setFilters]);

  useEffect(() => {
    // Whenever the data source or client-side filters change, clear stale paginated data
    // and revalidate discover seeds so the next page load starts fresh.
    resetPagination();
    setPageMovies([]);
    resetDedupe();
    invalidateCache();
    setIsHydrating(true);
  }, [trimmedQuery, filters.genreId, clientFilterKey, resetPagination, resetDedupe, invalidateCache]);

  useEffect(() => {
    if (isDefaultMode && baseMovies.length > 0) {
      setIsHydrating(false);
    }
  }, [isDefaultMode, baseMovies.length]);

  useEffect(() => {
    if (isDefaultMode) return;

    const loadFirstPage = async () => {
      resetPagination();
      setPageMovies([]);
      resetDedupe();
      setIsHydrating(true);

      try {
        const { movies } = await fetchPage(1);
        if (movies && movies.length > 0) {
          const unique = deduplicate(movies);
          setPageMovies([unique]);
        } else {
          setPageMovies([[]]);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error("Failed to load first page:", err);
        setPageMovies([[]]);
      } finally {
        setIsHydrating(false);
      }
    };

    loadFirstPage();
  }, [isDefaultMode, clientFilterKey, fetchPage, resetPagination, resetDedupe, deduplicate]);

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

  useEffect(() => {
    if (isLoading || !hasClientFilters || uniqueMovies.length > 0 || isFetching || !hasMore) {
      return;
    }

    handleLoadNext();
  }, [hasClientFilters, handleLoadNext, hasMore, isFetching, isLoading, uniqueMovies.length]);

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
          disabled={shouldDisableControls}
        />

        <GenreFilter
          genres={genres}
          selectedGenreId={filters.genreId}
          onGenreChange={handleGenreChange}
        />

        <div className="space-y-4">
          <MetadataChipFilter
            label="Mood / Vibe"
            options={metadata.derived.moods}
            selectedValues={filters.moods}
            onToggle={(value) => handleToggleFilterArray("moods", value)}
          />
          <MetadataChipFilter
            label="Tags"
            options={metadata.derived.tags}
            selectedValues={filters.tags}
            onToggle={(value) => handleToggleFilterArray("tags", value)}
          />
        </div>

        <AdvancedFilters
          runtimeRange={filters.runtimeRange}
          onRuntimeChange={handleRuntimeChange}
          metadata={metadata}
          languages={filters.languages}
          countries={filters.countries}
          onToggleLanguage={(value) => handleToggleFilterArray("languages", value)}
          onToggleCountry={(value) => handleToggleFilterArray("countries", value)}
        />

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <ClearFilters
            activeCount={activeFilterCount}
            movieCount={uniqueMovies.length}
            onClear={clearAllFilters}
            isLoading={shouldDisableControls}
          />
          <SortSelector
            value={filters.sortBy}
            onChange={handleSortChange}
            disabled={shouldDisableControls}
          />
        </div>

        <MovieGrid movies={uniqueMovies} isLoading={isLoading} />

        {!isLoading && (uniqueMovies.length > 0 || hasClientFilters) && (
          <PaginationLoader isLoading={isFetching} hasMore={hasMore} onLoadMore={handleLoadNext} />
        )}
      </div>
    </div>
  );
}

/**
 * Entry point for the Smart Discover page.
 */
export default function Discover() {
  return (
    <ErrorBoundary>
      <DiscoverContent />
    </ErrorBoundary>
  );
}