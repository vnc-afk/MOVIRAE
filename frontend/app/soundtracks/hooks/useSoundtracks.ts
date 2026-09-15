"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { clearSoundtrackCache, fetchSoundtrackByMovieId, fetchSoundtrackPage, prioritizeSoundtrackRefresh } from "../lib/repository";
import { useSoundtrackDedupe } from "./useSoundtrackDedupe";
import { useSoundtrackPagination } from "./useSoundtrackPagination";
import { useSoundtracksUrlState } from "./useSoundtracksUrlState";

export function useSoundtracks() {
  const url = useSoundtracksUrlState();
  const { addUnique, reset: resetDedupe } = useSoundtrackDedupe();
  const queryRef = useRef(url.query);
  queryRef.current = url.query;

  const fetchPage = useCallback((page: number, signal?: AbortSignal) => {
    const query = queryRef.current;
    return fetchSoundtrackPage(query.search, page, signal);
  }, []);
  const pagination = useSoundtrackPagination(fetchPage);
  const { loadPage, reloadPage, replaceItem, reset, ...paginationState } = pagination;
  const refreshAttempts = useRef(0);

  useEffect(() => {
    refreshAttempts.current = 0;
    resetDedupe();
    reset();
    clearSoundtrackCache();
    void loadPage(1, addUnique);
  }, [addUnique, loadPage, reset, resetDedupe, url.query.search]);

  useEffect(() => {
    if (!paginationState.items.some((item) => item.tracksPending)) return;
    const interval = window.setInterval(() => {
      if (paginationState.isLoading || refreshAttempts.current >= 12) return;
      refreshAttempts.current += 1;
      clearSoundtrackCache();
      void reloadPage(1);
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [paginationState.isLoading, paginationState.items, reloadPage]);

  useEffect(() => {
    if (url.query.page > 1 && url.query.page > paginationState.page && !paginationState.isLoading) {
      void loadPage(url.query.page, addUnique);
    }
  }, [addUnique, loadPage, paginationState.isLoading, paginationState.page, url.query.page]);

  useEffect(() => {
    const selectedId = url.query.selectedId;
    if (!selectedId) return;

    const controller = new AbortController();
    void prioritizeSoundtrackRefresh(selectedId, controller.signal)
      .then(async (queued) => {
        if (controller.signal.aborted) return;
        refreshAttempts.current = 0;

        const maxAttempts = queued ? 10 : 1;
        for (let attempt = 0; attempt < maxAttempts && !controller.signal.aborted; attempt += 1) {
          if (attempt > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, 2_000));
          }

          const refreshed = await fetchSoundtrackByMovieId(selectedId, controller.signal);
          if (!refreshed || controller.signal.aborted) continue;

          replaceItem(refreshed);
          if (!refreshed.tracksPending && refreshed.tracks.length > 0) break;
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [replaceItem, url.query.selectedId]);

  const selected = useMemo(
    () => paginationState.items.find((item) => item.movieId === url.query.selectedId) ?? paginationState.items[0] ?? null,
    [paginationState.items, url.query.selectedId]
  );

  const select = useCallback((id: number) => url.setSelectedId(id), [url.setSelectedId]);
  const loadNext = useCallback(() => {
    if (paginationState.hasMore && !paginationState.isLoading) url.setPage(paginationState.page + 1);
  }, [paginationState.hasMore, paginationState.isLoading, paginationState.page, url.setPage]);

  return {
    ...url,
    ...paginationState,
    loadPage,
    reset,
    selected,
    select,
    loadNext,
  };
}
