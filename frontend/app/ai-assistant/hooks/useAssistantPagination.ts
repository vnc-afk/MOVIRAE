"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ASSISTANT_PAGE_SIZE } from "../lib/constants";
import { dedupeMovies } from "../lib/dedupe";
import type { Movie } from "@/lib/types";
import type { MoviePageFetcher } from "../lib/types";

export function useAssistantPagination(query: string, fetchPage: MoviePageFetcher) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [loadedQuery, setLoadedQuery] = useState("");
  const pageRef = useRef(0);
  const generationRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const loadPage = useCallback(async (page: number, append: boolean, generation: number) => {
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    try {
      const result = await fetchPage(query, page, controller.signal);
      if (generation !== generationRef.current) return;
      setMovies((current) => append ? [...current, ...dedupeMovies(result, new Set(current.map((movie) => movie.id)))] : dedupeMovies(result));
      pageRef.current = page;
      setHasMore(result.length >= ASSISTANT_PAGE_SIZE);
      setLoadedQuery(query);
      setError(null);
    } catch (cause) {
      if (generation === generationRef.current && !(cause instanceof DOMException && cause.name === "AbortError")) {
        setError(cause instanceof Error ? cause : new Error("Unable to load recommendations"));
      }
    } finally {
      if (generation === generationRef.current) {
        setIsLoading(false);
        setIsFetchingMore(false);
      }
    }
  }, [fetchPage, query]);

  useEffect(() => {
    generationRef.current += 1;
    controllerRef.current?.abort();
    const generation = generationRef.current;
    pageRef.current = 0;
    setMovies([]);
    setHasMore(false);
    setLoadedQuery("");
    if (!query) return;
    setIsLoading(true);
    void loadPage(1, false, generation);
    return () => {
      controllerRef.current?.abort();
    };
  }, [loadPage, query]);

  const loadMore = useCallback(() => {
    if (!query || isLoading || isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    void loadPage(pageRef.current + 1, true, generationRef.current);
  }, [hasMore, isFetchingMore, isLoading, loadPage, query]);

  return { movies, isLoading, isFetchingMore, hasMore, error, loadedQuery, loadMore };
}