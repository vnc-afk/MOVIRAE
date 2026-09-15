"use client";

import { useCallback, useRef } from "react";
import type { Soundtrack } from "../lib/types";

export function useSoundtrackDedupe() {
  const seenIds = useRef(new Set<number>());

  const addUnique = useCallback((items: Soundtrack[]) => items.filter((item) => {
    if (seenIds.current.has(item.movieId)) return false;
    seenIds.current.add(item.movieId);
    return true;
  }), []);

  const reset = useCallback(() => {
    seenIds.current = new Set<number>();
  }, []);

  return { addUnique, reset };
}
