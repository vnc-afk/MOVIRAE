"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";
import {
  getGenres,
  getMoviesByGenre,
  getTrendingMovies,
  searchMovies,
} from "@/lib/tmdb";
import type { Movie } from "@/lib/types";
import type { FilterState, GenreOption } from "../lib/types";
import { getFilterMode } from "../lib/filterUtils";
import { AbortedError, normalizeError } from "../lib/errors";
import { API_CONFIG } from "../lib/constants";

interface MoviePage {
  movies: Movie[];
  pageSize: number;
}

interface DiscoverDataState {
  genres: GenreOption[];
  baseMovies: Movie[];
  genresLoading: boolean;
  isDefaultMode: boolean;
  isSearchMode: boolean;
  isGenreMode: boolean;
  error: Error | null;
  fetchPage: (page: number, signal?: AbortSignal) => Promise<MoviePage>;
  invalidateCache: () => void;
}

/**
 * Hook: Manage data fetching for discover feature
 *
 * Responsibilities:
 * - Load genres on mount with error handling
 * - Fetch movies based on current mode (default/search/genre)
 * - Support request cancellation via AbortController
 * - Handle network timeouts
 * - Manage loading and error states
 *
 * Usage:
 *   const data = useDiscoverData(filters);
 *   if (data.error) return <ErrorUI error={data.error} />;
 *   const movies = await data.fetchPage(2);
 */
export function useDiscoverData(filters: FilterState): DiscoverDataState {
  const queryClient = useQueryClient();
  const [genres, setGenres] = useState<GenreOption[]>([]);
  const [genresLoading, setGenresLoading] = useState(true);
  const [genresError, setGenresError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const mode = useMemo(() => getFilterMode(filters), [filters]);
  const trimmedQuery = filters.query.trim();
  const isDefaultMode = mode === "default";
  const isSearchMode = mode === "search";
  const isGenreMode = mode === "genre";

  // Load genres on component mount
  useEffect(() => {
    const loadGenres = async () => {
      setGenresLoading(true);
      setGenresError(null);

      try {
        const signal = AbortSignal.timeout(API_CONFIG.TIMEOUT_MS);
        const genreList = await Promise.race([
          getGenres({ signal }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Genres request timeout")),
              API_CONFIG.TIMEOUT_MS
            )
          ),
        ]);
        setGenres(genreList);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          console.warn("Genres request was cancelled");
          setGenresError(new AbortedError("Genres request cancelled"));
        } else {
          const error = normalizeError(err);
          setGenresError(error);
          console.error("Failed to load genres:", error);
        }
        setGenres([]);
      } finally {
        setGenresLoading(false);
      }
    };

    loadGenres();
  }, []);

  // Fetch trending movies (only in default mode)
  const trendingQuery = usePrefetchAwareQuery<Movie[]>({
    queryKey: queryKeys.discover.seeds(),
    queryFn: async () => {
      const signal = AbortSignal.timeout(API_CONFIG.TIMEOUT_MS);
      try {
        return await getTrendingMovies(1, { signal });
      } catch (err) {
        throw normalizeError(err);
      }
    },
    enabled: isDefaultMode,
    retry: API_CONFIG.RETRY_ATTEMPTS,
  });

  const baseMovies = trendingQuery.data ?? [];

  /**
   * Fetch a specific page based on current mode with cancellation support
   * @param page - Page number to fetch
   * @param signal - Optional AbortSignal for request cancellation
   * @returns Promise with movies and page size
   */
  const fetchPage = useCallback(
    async (page: number, signal?: AbortSignal): Promise<MoviePage> => {
      // Cancel previous request if new one is initiated
      if (abortControllerRef.current) {
        abortControllerRef.current.abort(
          new DOMException("Request superseded", "AbortError")
        );
      }

      // Create new abort controller if signal not provided
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Merge signals if both are provided
      const mergedSignal = signal
        ? AbortSignal.any([controller.signal, signal])
        : controller.signal;

      let results: Movie[] = [];

      try {
        if (isSearchMode) {
          results = await searchMovies(trimmedQuery, page, { signal: mergedSignal });
        } else if (isGenreMode) {
          results = await getMoviesByGenre(
            Number(filters.genreId),
            page,
            { signal: mergedSignal }
          );
        } else {
          results = await getTrendingMovies(page, { signal: mergedSignal });
        }

        return {
          movies: results,
          pageSize: results.length,
        };
      } catch (err) {
        const error = normalizeError(err);

        if (mergedSignal.aborted) {
          return {
            movies: [],
            pageSize: 0,
          };
        }

        // Only log non-abort errors
        if (!(error instanceof AbortedError)) {
          console.error(`Failed to fetch page ${page}:`, error);
        }

        return {
          movies: [],
          pageSize: 0,
        };
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [isSearchMode, isGenreMode, trimmedQuery, filters.genreId]
  );

  /**
   * Invalidate TMDB caches when filters change significantly
   */
  const invalidateCache = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.discover.seeds(),
    });
  }, [queryClient]);

  // Cleanup: abort any pending requests on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort(
          new DOMException("Component unmounted", "AbortError")
        );
      }
    };
  }, []);

  return {
    genres,
    baseMovies,
    genresLoading,
    isDefaultMode,
    isSearchMode,
    isGenreMode,
    error: genresError || trendingQuery.error || null,
    fetchPage,
    invalidateCache,
  };
}
