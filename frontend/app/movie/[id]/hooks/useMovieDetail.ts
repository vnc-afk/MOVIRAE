
import { useMemo } from "react";
import React, { useEffect, useCallback } from "react";
import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";
import { queryKeys } from "@/lib/queryKeys";
import { getStreamingPlatforms } from "@/lib/watchmode";
import type { Movie } from "@/lib/types";

async function fetchMovieDetails(movieId: string): Promise<Movie | null> {
  const response = await fetch(`/api/tmdb/movie/${movieId}`);
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  return (data as Movie | null) ?? null;
}

async function fetchSimilarMovies(movieId: string): Promise<Movie[]> {
  const response = await fetch(`/api/tmdb/movie/${movieId}/similar`);
  if (!response.ok) return [];
  const data = await response.json().catch(() => null);
  return Array.isArray(data) ? data : [];
}

export interface UseMovieDetailOptions {
  movieId: string;
  enabled?: boolean;
}

export interface UseMovieDetailResult {
  movie: Movie | null;
  similar: Movie[];
  isLoading: boolean;
  error: Error | null;
  streamingOn: string[];
  streamingLoading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Loads the primary movie detail record, similar movie recommendations,
 * and the streaming availability for the current movie.
 */
export function useMovieDetail({ movieId, enabled = true }: UseMovieDetailOptions): UseMovieDetailResult {
  const movieQuery = usePrefetchAwareQuery<Movie | null>({
    queryKey: queryKeys.movie.detail(movieId),
    queryFn: () => fetchMovieDetails(movieId),
    enabled: enabled && Boolean(movieId),
  });

  const similarQuery = usePrefetchAwareQuery<Movie[]>({
    queryKey: queryKeys.movie.recommendations(movieId),
    queryFn: () => fetchSimilarMovies(movieId),
    enabled: enabled && Boolean(movieId),
  });

  const [streamingOn, setStreamingOn] = React.useState<string[]>([]);
  const [streamingLoading, setStreamingLoading] = React.useState(true);

  useEffect(() => {
    if (!movieQuery.data) {
      return;
    }

    // Avoid updating state after the component has unmounted or the movie id has changed.
    let cancelled = false;

    setStreamingLoading(true);
    setStreamingOn([]);

    void getStreamingPlatforms(movieQuery.data.id)
      .then((platforms) => {
        if (!cancelled) {
          setStreamingOn(platforms);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch streaming platforms:", error);
        if (!cancelled) {
          setStreamingOn([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStreamingLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [movieQuery.data?.id]);

  const refetch = useCallback(async () => {
    await movieQuery.refetch();
    await similarQuery.refetch();
  }, [movieQuery, similarQuery]);

  return {
    movie: movieQuery.data ?? null,
    similar: useMemo(() => similarQuery.data?.slice(0, 6) ?? [], [similarQuery.data]),
    isLoading: movieQuery.isPending,
    error: movieQuery.error,
    streamingOn,
    streamingLoading,
    refetch,
  };
}
