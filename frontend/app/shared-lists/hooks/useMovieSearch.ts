"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { searchMovies } from "@/lib/tmdb";
import { generateOpId, attachOpToBody, attachOpToHeaders } from "@/lib/optimistic";
import { useQueryClient } from "@tanstack/react-query";
import type { Movie } from "@/lib/types";
import { queryKeys } from "@/lib/queryKeys";
import { applyEntityUpdate } from "@/lib/cacheHelpers";
import { SharedListsSnapshot, MovieSearchState } from "../lib/types";

export function useMovieSearch(selectedListId: string | null) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (!selectedListId || trimmedQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    const timeoutId = setTimeout(() => {
      searchMovies(trimmedQuery)
        .then((found) => {
          if (!active) return;
          setResults(found.slice(0, 6));
        })
        .catch((err) => {
          console.error("Failed to search movies:", err);
          if (!active) return;
          setError("Could not search movies right now.");
        })
        .finally(() => {
          if (active) {
            setIsLoading(false);
          }
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [query, selectedListId]);

  const reset = () => {
    setQuery("");
    setResults([]);
    setError(null);
  };

  return { query, setQuery, results, isLoading, error, reset };
}

export function useAddMovieToList(snapshot: SharedListsSnapshot) {
  const [addingToListId, setAddingToListId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const addMovieToList = async (
    listId: string,
    movieId: string,
    movieSearchResults: Movie[]
  ) => {
    const optimisticMovie = movieSearchResults.find((movie) => movie.id === movieId);

    if (optimisticMovie) {
      applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
        if (!current) return current;
        return {
          ...current,
          lists: current.lists.map((item) =>
            item.id === listId
              ? {
                  ...item,
                  movies: [...item.movies, optimisticMovie],
                }
              : item
          ),
        };
      });
    }

    setAddingToListId(listId);
    const previousLists = snapshot.lists;
    const op = { opId: generateOpId("shared-list-add-movie"), type: "update" as const, itemId: listId, ts: Date.now() };

    try {
      const bodyObj = attachOpToBody({ movieId }, op);
      const headers = attachOpToHeaders({ "Content-Type": "application/json" }, op);

      const response = await fetch(`/api/shared-lists/${listId}/movies`, {
        method: "POST",
        headers,
        body: JSON.stringify(bodyObj),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to add movie.");
      }

      const nextLists = Array.isArray(payload?.value) ? payload.value : [];
      applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
        if (!current) return current;
        return { ...current, lists: nextLists };
      });

      toast.success("Movie added to list");
    } catch (error) {
      applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
        if (!current) return current;
        return { ...current, lists: previousLists };
      });
      const message = error instanceof Error ? error.message : "Could not add movie.";
      toast.error(message);
    } finally {
      setAddingToListId(null);
    }
  };

  return { addMovieToList, addingToListId };
}

export function useRemoveMovieFromList(snapshot: SharedListsSnapshot) {
  const [removingFromListId, setRemovingFromListId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const removeMovieFromList = async (listId: string, movieId: string) => {
    const previousLists = snapshot.lists;
    applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
      if (!current) return current;
      return {
        ...current,
        lists: current.lists.map((item) =>
          item.id === listId
            ? {
                ...item,
                movies: item.movies.filter((movie) => movie.id !== movieId),
              }
            : item
        ),
      };
    });

    setRemovingFromListId(listId);
    const op = { opId: generateOpId("shared-list-remove-movie"), type: "delete" as const, itemId: listId, ts: Date.now() };

    try {
      const bodyObj = attachOpToBody({ movieId }, op);
      const headers = attachOpToHeaders({ "Content-Type": "application/json" }, op);

      const response = await fetch(`/api/shared-lists/${listId}/movies`, {
        method: "DELETE",
        headers,
        body: JSON.stringify(bodyObj),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to remove movie.");
      }

      const nextLists = Array.isArray(payload?.value) ? payload.value : [];
      applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
        if (!current) return current;
        return { ...current, lists: nextLists };
      });

      toast.success("Movie removed from list");
    } catch (error) {
      applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
        if (!current) return current;
        return { ...current, lists: previousLists };
      });
      const message = error instanceof Error ? error.message : "Could not remove movie.";
      toast.error(message);
    } finally {
      setRemovingFromListId(null);
    }
  };

  return { removeMovieFromList, removingFromListId };
}
