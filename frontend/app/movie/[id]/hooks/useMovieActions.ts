
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import * as movieApi from "../lib/movieApi";

export interface UseMovieActionsResult {
  isWatched: boolean;
  isWatchlist: boolean;
  isLiked: boolean;
  initializing: boolean;
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

/**
 * Hook for tracking the current user's movie action state.
 * Handles watched, watchlist, and favorite toggles, and keeps UI state synced
 * with the server response.
 */
export function useMovieActions(movieId: string): UseMovieActionsResult {
  const queryClient = useQueryClient();

  const [isWatched, setIsWatched] = useState(false);
  const [isWatchlist, setIsWatchlist] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState({ watched: false, watchlist: false, liked: false });

  const setInitialState = useCallback(
    (watchlistIds: string[], favoriteIds: string[], watchedIds: string[]) => {
      setIsWatchlist(watchlistIds.includes(movieId));
      setIsLiked(favoriteIds.includes(movieId));
      setIsWatched(watchedIds.includes(movieId));
      setInitializing(false);
    },
    [movieId]
  );

  const toggleWatched = useCallback(async () => {
    setLoading((prev) => ({ ...prev, watched: true }));
    try {
      const result = await movieApi.updateMovieAction(
        "watched",
        movieId,
        !isWatched
      );

      // If the API returns the updated list, keep local state in sync.
      if (Array.isArray(result)) {
        setIsWatched(result.includes(movieId));
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
        "watchlist",
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
        "favorites",
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
    initializing,
    loading,
    toggleWatched,
    toggleWatchlist,
    toggleLiked,
    setInitialState,
  };
}
