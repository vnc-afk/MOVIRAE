"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { Movie } from "@/lib/types";
import type { FilterState, GenreOption, DiscoverMetadata } from "../lib/types";
import { getFilterMode } from "../lib/filterUtils";
import { AbortedError, normalizeError } from "../lib/errors";
import { API_CONFIG } from "../lib/constants";

async function fetchGenres(signal?: AbortSignal): Promise<GenreOption[]> {
  const response = await fetch("/api/tmdb/genre", { signal });
  if (!response.ok) return [];
  const data = await response.json().catch(() => null);
  return Array.isArray(data) ? data : [];
}

async function fetchMetadata(signal?: AbortSignal): Promise<DiscoverMetadata> {
  const response = await fetch("/api/discover/metadata", { signal });
  if (!response.ok) {
    return {
      native: {
        genres: [],
        languages: [],
        countries: [],
      },
      derived: {
        moods: [],
        tags: [],
      },
    };
  }

  const data = await response.json().catch(() => null);
  if (!data || typeof data !== "object") {
    return {
      native: {
        genres: [],
        languages: [],
        countries: [],
      },
      derived: {
        moods: [],
        tags: [],
      },
    };
  }

  return {
    native: {
      genres: Array.isArray(data.native?.genres) ? data.native.genres : [],
      languages: Array.isArray(data.native?.languages) ? data.native.languages : [],
      countries: Array.isArray(data.native?.countries) ? data.native.countries : [],
    },
    derived: {
      moods: Array.isArray(data.derived?.moods) ? data.derived.moods : [],
      tags: Array.isArray(data.derived?.tags) ? data.derived.tags : [],
    },
  };
}

async function fetchTrending(page: number, signal?: AbortSignal): Promise<Movie[]> {
  const response = await fetch(`/api/tmdb/trending?page=${page}`, { signal });
  if (!response.ok) return [];
  const data = await response.json().catch(() => null);
  return Array.isArray(data) ? data : [];
}

async function fetchSearch(query: string, page: number, signal?: AbortSignal): Promise<Movie[]> {
  const response = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}&page=${page}`, {
    signal,
  });
  if (!response.ok) return [];
  const data = await response.json().catch(() => null);
  return Array.isArray(data) ? data : [];
}

async function fetchByGenre(
  genreId: number,
  page: number,
  sortBy: FilterState["sortBy"],
  signal?: AbortSignal
): Promise<Movie[]> {
  const genreParam = genreId > 0 ? `&genreId=${genreId}` : "";
  const response = await fetch(`/api/tmdb/discover?sortBy=${sortBy}${genreParam}&page=${page}`, {
    signal,
  });
  if (!response.ok) return [];
  const data = await response.json().catch(() => null);
  return Array.isArray(data) ? data : [];
}

interface MoviePage {
  movies: Movie[];
  pageSize: number;
}

/**
 * Aggregates the discover page data sources and pagination fetcher used by the page shell.
 */
interface DiscoverDataState {
  genres: GenreOption[];
  metadata: DiscoverMetadata;
  baseMovies: Movie[];
  genresLoading: boolean;
  metadataLoading: boolean;
  isDefaultMode: boolean;
  isSearchMode: boolean;
  isGenreMode: boolean;
  error: Error | null;
  fetchPage: (page: number, signal?: AbortSignal) => Promise<MoviePage>;
  invalidateCache: () => void;
}

/**
 * Loads the discover page's genre list and resolves the appropriate movie source for the active filter mode.
 *
 * @param filters - Current discover filters that determine whether the page is in default, search, or genre mode.
 * @returns A unified state object for the page to render and paginate results.
 */
export function useDiscoverData(filters: FilterState): DiscoverDataState {
  const queryClient = useQueryClient();
  const [genres, setGenres] = useState<GenreOption[]>([]);
  const [metadata, setMetadata] = useState<DiscoverMetadata>({
    native: {
      genres: [],
      languages: [],
      countries: [],
    },
    derived: {
      moods: [],
      tags: [],
    },
  });
  const [genresLoading, setGenresLoading] = useState(true);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [genresError, setGenresError] = useState<Error | null>(null);
  const [metadataError, setMetadataError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const mode = useMemo(() => getFilterMode(filters), [filters]);
  const trimmedQuery = filters.query.trim();
  const isDefaultMode = mode === "default";
  const isSearchMode = mode === "search";
  const isGenreMode = mode === "genre";

  useEffect(() => {
    const loadGenres = async () => {
      setGenresLoading(true);
      setGenresError(null);
      try {
        const signal = AbortSignal.timeout(API_CONFIG.TIMEOUT_MS);
        const genreList = await Promise.race([
          fetchGenres(signal),
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

    const loadMetadata = async () => {
      setMetadataLoading(true);
      setMetadataError(null);
      try {
        const signal = AbortSignal.timeout(API_CONFIG.TIMEOUT_MS);
        const nextMetadata = await Promise.race([
          fetchMetadata(signal),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Metadata request timeout")),
              API_CONFIG.TIMEOUT_MS
            )
          ),
        ]);
        setMetadata(nextMetadata);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          console.warn("Metadata request was cancelled");
          setMetadataError(new AbortedError("Metadata request cancelled"));
        } else {
          const error = normalizeError(err);
          setMetadataError(error);
          console.error("Failed to load discover metadata:", error);
        }
        setMetadata({
          native: { genres: [], languages: [], countries: [] },
          derived: { moods: [], tags: [] },
        });
      } finally {
        setMetadataLoading(false);
      }
    };

    loadGenres();
    loadMetadata();
  }, []);

  // Trending data is only relevant when the user is not actively searching or filtering by genre.
  const trendingQuery = useQuery<Movie[]>({
    queryKey: queryKeys.discover.seeds(filters.sortBy),
    queryFn: async () => {
      const signal = AbortSignal.timeout(API_CONFIG.TIMEOUT_MS);
      try {
        return await fetchByGenre(0, 1, filters.sortBy, signal);
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
        // Cancel any in-flight request before starting the next page fetch so older results cannot race back in.
        abortControllerRef.current.abort(new DOMException("Request superseded", "AbortError"));
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const mergedSignal = signal ? AbortSignal.any([controller.signal, signal]) : controller.signal;

      let results: Movie[] = [];

      try {
        if (isSearchMode) {
          results = await fetchSearch(trimmedQuery, page, mergedSignal);
        } else if (isGenreMode) {
          results = await fetchByGenre(Number(filters.genreId), page, filters.sortBy, mergedSignal);
        } else {
          results = await fetchByGenre(0, page, filters.sortBy, mergedSignal);
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
    [isSearchMode, isGenreMode, trimmedQuery, filters.genreId, filters.sortBy]
  );

  const invalidateCache = useCallback(() => {
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
    metadata,
    baseMovies,
    genresLoading,
    metadataLoading,
    isDefaultMode,
    isSearchMode,
    isGenreMode,
    error: genresError || metadataError || trendingQuery.error || null,
    fetchPage,
    invalidateCache,
  };
}
