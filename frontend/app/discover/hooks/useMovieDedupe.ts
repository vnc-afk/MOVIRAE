"use client";

import { useCallback, useRef } from "react";
import type { Movie } from "@/lib/types";

/**
 * Hook: Manage movie deduplication across paginated results
 *
 * Responsibilities:
 * - Maintain a set of seen movie IDs
 * - Deduplicate incoming movie results
 * - Reset when filters change
 *
 * Usage:
 *   const { deduplicate, reset, isSeen } = useMovieDedupe();
 *   const unique = movies.filter(m => !isSeen(m.id));
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
