"use client";

import { useCallback, useRef, useState } from "react";
import type { Soundtrack, SoundtrackPage } from "../lib/types";

export function useSoundtrackPagination(fetchPage: (page: number, signal?: AbortSignal) => Promise<SoundtrackPage>) {
  const [items, setItems] = useState<Soundtrack[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    requestRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setItems([]);
    setPage(0);
    setHasMore(true);
    setError(null);
  }, []);

  const loadPage = useCallback(async (nextPage: number, merge: (items: Soundtrack[]) => Soundtrack[]) => {
    const requestId = ++requestRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchPage(nextPage, controller.signal);
      if (requestId !== requestRef.current) return;
      setItems((current) => merge([...current, ...result.items]));
      setPage(result.page);
      setHasMore(result.hasMore);
    } catch (cause) {
      if (isAbortError(cause)) return;
      if (requestId === requestRef.current) {
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      }
    } finally {
      if (requestId === requestRef.current) {
        abortRef.current = null;
        setIsLoading(false);
      }
    }
  }, [fetchPage]);

  const reloadPage = useCallback(async (nextPage: number) => {
    const requestId = ++requestRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    try {
      const result = await fetchPage(nextPage, controller.signal);
      if (requestId !== requestRef.current) return;
      const refreshedIds = new Set(result.items.map((item) => item.movieId));
      setItems((current) => [...result.items, ...current.filter((item) => !refreshedIds.has(item.movieId))]);
      setPage(result.page);
      setHasMore(result.hasMore);
    } catch (cause) {
      if (isAbortError(cause)) return;
      if (requestId === requestRef.current) setError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      if (requestId === requestRef.current) {
        abortRef.current = null;
        setIsLoading(false);
      }
    }
  }, [fetchPage]);

  const replaceItem = useCallback((item: Soundtrack) => {
    setItems((current) => current.map((existing) => existing.movieId === item.movieId ? item : existing));
  }, []);

  return { items, page, hasMore, isLoading, error, reset, loadPage, reloadPage, replaceItem };
}

function isAbortError(cause: unknown) {
  return cause instanceof DOMException && cause.name === "AbortError"
    || cause instanceof Error && cause.name === "AbortError";
}
