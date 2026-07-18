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
 * Loads discover metadata and exposes an abortable page fetcher for pagination.
 *
 * This hook supports the default trending flow as well as search and genre filters.
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
      // Load the genre list once on mount; genre errors are surfaced but do not block movie fetching.

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

  const fetchPage = useCallback(
    async (page: number, signal?: AbortSignal): Promise<MoviePage> => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort(new DOMException("Request superseded", "AbortError"));
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const mergedSignal = signal ? AbortSignal.any([controller.signal, signal]) : controller.signal;

      let results: Movie[] = [];

      try {
        // Select the appropriate movie source according to the active discover mode.
        if (isSearchMode) {
          results = await searchMovies(trimmedQuery, page, { signal: mergedSignal });
        } else if (isGenreMode) {
          results = await getMoviesByGenre(Number(filters.genreId), page, { signal: mergedSignal });
        } else {
          results = await getTrendingMovies(page, { signal: mergedSignal });
        }

        return { movies: results, pageSize: results.length };
      } catch (err) {

        if (mergedSignal.aborted) {
          throw new DOMException("Request aborted", "AbortError");
        }

        const error = normalizeError(err);
        if (!(error instanceof AbortedError)) {
          console.error(`Failed to fetch page ${page}:`, error);
        }
        return { movies: [], pageSize: 0 };
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [isSearchMode, isGenreMode, trimmedQuery, filters.genreId]
  );

  const invalidateCache = useCallback(() => {
    // Invalidate trending seeds so default mode reloads fresh results after filter resets.
    queryClient.invalidateQueries({
      queryKey: queryKeys.discover.seeds(),
    });
  }, [queryClient]);
  
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
