/**
 * useMovieActions Hook
 * Manages watched, watchlist, and liked state with optimistic updates
 */

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import * as movieApi from "../lib/movieApi";

export interface UseMovieActionsResult {
  isWatched: boolean;
  isWatchlist: boolean;
  isLiked: boolean;
  loading: {
    watched: boolean;
    watchlist: boolean;
    liked: boolean;
  };
  toggleWatched: () => Promise<void>;
  toggleWatchlist: () => Promise<void>;
  toggleLiked: () => Promise<void>;
  setInitialState: (watchlist: string[], favorites: string[], watched: string[]) => void;
}

export function useMovieActions(movieId: string): UseMovieActionsResult {
  const queryClient = useQueryClient();

  const [isWatched, setIsWatched] = useState(false);
  const [isWatchlist, setIsWatchlist] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState({ watched: false, watchlist: false, liked: false });

  const setInitialState = useCallback(
    (watchlistIds: string[], favoriteIds: string[], watchedIds: string[]) => {
      setIsWatchlist(watchlistIds.includes(movieId));
      setIsLiked(favoriteIds.includes(movieId));
      setIsWatched(watchedIds.includes(movieId));
    },
    [movieId]
  );

  const toggleWatched = useCallback(async () => {
    setLoading((prev) => ({ ...prev, watched: true }));
    try {
      const result = await movieApi.updateMovieAction(
        "user-watched-current",
        movieId,
        !isWatched
      );

      if (Array.isArray(result)) {
        setIsWatched(result.includes(movieId));
        // Invalidate stats caches when watched status changes
        queryClient.invalidateQueries({ queryKey: queryKeys.stats.current() });
        queryClient.invalidateQueries({ queryKey: queryKeys.wrapped.current() });
      }
    } finally {
      setLoading((prev) => ({ ...prev, watched: false }));
    }
  }, [movieId, isWatched, queryClient]);

  const toggleWatchlist = useCallback(async () => {
    setLoading((prev) => ({ ...prev, watchlist: true }));
    try {
      const result = await movieApi.updateMovieAction(
        "user-watchlist-current",
        movieId,
        !isWatchlist
      );

      if (Array.isArray(result)) {
        setIsWatchlist(result.includes(movieId));
      }
    } finally {
      setLoading((prev) => ({ ...prev, watchlist: false }));
    }
  }, [movieId, isWatchlist]);

  const toggleLiked = useCallback(async () => {
    setLoading((prev) => ({ ...prev, liked: true }));
    try {
      const result = await movieApi.updateMovieAction(
        "user-favorites-current",
        movieId,
        !isLiked
      );

      if (Array.isArray(result)) {
        setIsLiked(result.includes(movieId));
      }
    } finally {
      setLoading((prev) => ({ ...prev, liked: false }));
    }
  }, [movieId, isLiked]);

  return {
    isWatched,
    isWatchlist,
    isLiked,
    loading,
    toggleWatched,
    toggleWatchlist,
    toggleLiked,
    setInitialState,
  };
}
