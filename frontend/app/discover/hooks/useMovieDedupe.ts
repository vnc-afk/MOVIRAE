"use client";

import { useCallback, useRef } from "react";
import type { Movie } from "@/lib/types";

/**
 * Tracks seen movie IDs so paginated discover results can avoid rendering duplicate cards across fetches.
 */
export function useMovieDedupe() {
  const seenIdsRef = useRef<Set<string>>(new Set());

  const isSeen = useCallback((id: string): boolean => {
    return seenIdsRef.current.has(id);
  }, []);

  const deduplicate = useCallback((movies: Movie[]): Movie[] => {
    return movies.filter((movie) => {
      if (seenIdsRef.current.has(movie.id)) {
        return false;
      }
      seenIdsRef.current.add(movie.id);
      return true;
    });
  }, []);

  const reset = useCallback((): void => {
    seenIdsRef.current = new Set();
  }, []);

  const addIds = useCallback((ids: string[]): void => {
    ids.forEach((id) => seenIdsRef.current.add(id));
  }, []);

  return { deduplicate, reset, isSeen, addIds };
}
