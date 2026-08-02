"use client";

import { useCallback, useEffect, useRef } from "react";

interface HasId {
  id: string;
}

/**
 * Tracks observed IDs so paginated recommendation lists can avoid repeating the same movie card.
 */
export function useRecommendationsDedup<T extends HasId>(initialItems: T[]) {
  const seenIdsRef = useRef<Set<string>>(new Set(initialItems.map((item) => item.id)));

  useEffect(() => {
    seenIdsRef.current = new Set(initialItems.map((item) => item.id));
  }, [initialItems]);

  const dedupe = useCallback((items: T[]) => {
    return items.filter((item) => {
      if (seenIdsRef.current.has(item.id)) {
        return false;
      }

      seenIdsRef.current.add(item.id);
      return true;
    });
  }, []);

  const addIds = useCallback((ids: string[]) => {
    ids.forEach((id) => seenIdsRef.current.add(id));
  }, []);

  const reset = useCallback(() => {
    seenIdsRef.current = new Set();
  }, []);

  const isSeen = useCallback((id: string) => {
    return seenIdsRef.current.has(id);
  }, []);

  return {
    dedupe,
    addIds,
    reset,
    isSeen,
  };
}
