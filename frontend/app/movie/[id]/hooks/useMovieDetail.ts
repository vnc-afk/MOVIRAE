/**
 * useMovieDetail Hook
 * Fetches and manages movie details with caching
 */

import React, { useEffect, useCallback } from "react";
import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";
import { queryKeys } from "@/lib/queryKeys";
import { getMovieDetails, getSimilarMovies } from "@/lib/tmdb";
import { getStreamingPlatforms } from "@/lib/watchmode";
import type { Movie } from "@/lib/types";

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

export function useMovieDetail({ movieId, enabled = true }: UseMovieDetailOptions): UseMovieDetailResult {
  const movieQuery = usePrefetchAwareQuery<Movie | null>({
    queryKey: queryKeys.movie.detail(movieId),
    queryFn: () => getMovieDetails(movieId),
    enabled: enabled && Boolean(movieId),
  });

  const similarQuery = usePrefetchAwareQuery<Movie[]>({
    queryKey: queryKeys.movie.recommendations(movieId),
    queryFn: () => getSimilarMovies(movieId),
    enabled: enabled && Boolean(movieId),
  });

  const [streamingOn, setStreamingOn] = React.useState<string[]>([]);
  const [streamingLoading, setStreamingLoading] = React.useState(true);

  useEffect(() => {
    if (!movieQuery.data) {
      return;
    }

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
    similar: similarQuery.data?.slice(0, 6) ?? [],
    isLoading: movieQuery.isPending,
    error: movieQuery.error,
    streamingOn,
    streamingLoading,
    refetch,
  };
}
