"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { searchMovies } from "@/lib/tmdb";
import type { Group, Movie, SharedList, UserProfile } from "@/lib/types";
import { SharedListsView } from "./shared-lists-view";

type SharedListsResponse = {
  value?: SharedList[];
  currentUser?: Pick<UserProfile, "id" | "email"> | null;
  error?: string;
};

export default function SharedListsPage() {
  const searchParams = useSearchParams();
  const [lists, setLists] = useState<SharedList[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  const [openCreate, setOpenCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newVisibility, setNewVisibility] = useState<"public" | "private" | "group">("public");
  const [newGroupId, setNewGroupId] = useState<string>("");
  const [newCommentByList, setNewCommentByList] = useState<Record<string, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [openReplyFor, setOpenReplyFor] = useState<string | null>(null);
  const [movieSearchQuery, setMovieSearchQuery] = useState("");
  const [movieSearchResults, setMovieSearchResults] = useState<Movie[]>([]);
  const [movieSearchLoading, setMovieSearchLoading] = useState(false);
  const [movieSearchError, setMovieSearchError] = useState<string | null>(null);
  const [addingMovieToListId, setAddingMovieToListId] = useState<string | null>(null);
  const [removingMovieFromListId, setRemovingMovieFromListId] = useState<string | null>(null);

  const selectedList = useMemo(
    () => lists.find((list) => list.id === selectedListId) ?? null,
    [lists, selectedListId]
  );

  useEffect(() => {
    const listIdFromQuery = searchParams.get("listId");
    if (!listIdFromQuery) {
      return;
    }

    if (lists.some((list) => list.id === listIdFromQuery)) {
      setSelectedListId(listIdFromQuery);
    }
  }, [lists, searchParams]);

  const parseResponsePayload = async (response: Response) => {
    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text) as { value?: unknown; error?: string };
    } catch {
      throw new Error("Received an invalid server response.");
    }
  };

  const loadSharedLists = async () => {
    const response = await fetch("/api/shared-lists", { cache: "no-store" });
    const payload = (await parseResponsePayload(response)) as SharedListsResponse | null;

    if (!response.ok) {
      throw new Error(payload?.error || "Failed to load shared lists.");
    }

    const nextLists = Array.isArray(payload?.value) ? payload.value : [];
    setLists(nextLists);
    setCurrentUser((existingUser) => {
      const authenticatedUser = payload?.currentUser;
      if (!authenticatedUser?.id) {
        return null;
      }

      return (
        nextLists.find((list) => list.owner.id === authenticatedUser.id)?.owner ??
        nextLists
          .flatMap((list) => list.collaborators)
          .find((collaborator) => collaborator.id === authenticatedUser.id) ??
        existingUser ?? {
          id: authenticatedUser.id,
          email: authenticatedUser.email,
          username: authenticatedUser.email?.split("@")[0] ?? "user",
          displayName: authenticatedUser.email?.split("@")[0] ?? "User",
          avatar: "",
          bio: "",
          followers: 0,
          following: 0,
          reviewCount: 0,
          watchlistCount: 0,
          favoriteMovies: [],
        }
      );
    });
    return nextLists;
  };

  const loadSupportingData = async () => {
    const groupsResponse = await fetch("/api/data/groups", { cache: "no-store" }).then((response) => response.json());
    setGroups(Array.isArray(groupsResponse.value) ? groupsResponse.value : []);
  };

  useEffect(() => {
    let isActive = true;
    let eventSource: EventSource | null = null;

    Promise.all([loadSharedLists(), loadSupportingData()]).catch((error) => {
      console.error("Failed to load shared lists:", error);
      if (isActive) {
        toast.error("Failed to load shared lists.");
      }
    });

    eventSource = new EventSource("/api/shared-lists/events");
    eventSource.addEventListener("shared-list-updated", () => {
      if (!isActive) return;

      loadSharedLists().catch((error) => {
        console.error("Failed to refresh shared lists:", error);
      });
    });
    eventSource.onerror = () => {
      // Browser retries automatically.
    };

    return () => {
      isActive = false;
      eventSource?.close();
    };
  }, []);

  useEffect(() => {
    if (!selectedListId) {
      setOpenReplyFor(null);
      setMovieSearchQuery("");
      setMovieSearchResults([]);
      setMovieSearchError(null);
      return;
    }

    const listStillExists = lists.some((list) => list.id === selectedListId);
    if (!listStillExists) {
      setSelectedListId(null);
    }
  }, [lists, selectedListId]);

  useEffect(() => {
    const trimmedQuery = movieSearchQuery.trim();

    if (!selectedList || trimmedQuery.length < 2) {
      setMovieSearchResults([]);
      setMovieSearchLoading(false);
      setMovieSearchError(null);
      return;
    }

    let active = true;
    setMovieSearchLoading(true);
    setMovieSearchError(null);

    const timeoutId = setTimeout(() => {
      searchMovies(trimmedQuery)
        .then((results) => {
          if (!active) return;
          setMovieSearchResults(results.slice(0, 6));
        })
        .catch((error) => {
          console.error("Failed to search movies:", error);
          if (!active) return;
          setMovieSearchError("Could not search movies right now.");
        })
        .finally(() => {
          if (active) {
            setMovieSearchLoading(false);
          }
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [movieSearchQuery, selectedList]);

  const createList = async () => {
    if (!currentUser) {
      toast.error("No active user profile available.");
      return;
    }

    if (!newName.trim()) {
      toast.error("List name is required.");
      return;
    }

    if (newVisibility === "group" && !newGroupId) {
      toast.error("Please select a group for group visibility.");
      return;
    }

    const response = await fetch("/api/shared-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        description: newDescription.trim(),
        visibility: newVisibility,
        groupId: newGroupId || undefined,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      toast.error(payload?.error || "Failed to create list.");
      return;
    }

    const payload = await response.json();
    setLists(Array.isArray(payload.value) ? payload.value : []);

    setNewName("");
    setNewDescription("");
    setNewVisibility("public");
    setNewGroupId("");
    setOpenCreate(false);

    toast.success("Shared list created");
  };

  const updateListsFromResponse = async (response: Response) => {
    const payload = await parseResponsePayload(response);

    if (!response.ok) {
      throw new Error(payload?.error || "Request failed.");
    }

    const nextLists = Array.isArray(payload?.value) ? payload.value : [];
    setLists(nextLists);
    return nextLists;
  };

  const mutateList = async (listId: string, endpoint: string, body?: Record<string, unknown>) => {
    const response = await fetch(`/api/shared-lists/${listId}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    return updateListsFromResponse(response);
  };

  const removeList = async (id: string) => {
    try {
      const response = await fetch(`/api/shared-lists/${id}`, { method: "DELETE" });
      await updateListsFromResponse(response);

      if (selectedListId === id) {
        setSelectedListId(null);
      }

      toast.success("List removed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not remove the list.";
      toast.error(message);
    }
  };

  const toggleLike = async (list: SharedList) => {
    try {
      await mutateList(list.id, "like");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update the like.";
      toast.error(message);
    }
  };

  const addComment = async (listId: string, parentId?: string) => {
    if (!currentUser) {
      toast.error("Sign in to comment.");
      return;
    }

    const body = (parentId ? replyDrafts[parentId] : newCommentByList[listId])?.trim();
    try {
      const response = await fetch(`/api/shared-lists/${listId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, parentId }),
      });

      await updateListsFromResponse(response);

      if (parentId) {
        setReplyDrafts((current) => ({ ...current, [parentId]: "" }));
        setOpenReplyFor(null);
      } else {
        setNewCommentByList((current) => ({ ...current, [listId]: "" }));
      }

      toast.success(parentId ? "Reply posted" : "Comment posted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not post the comment.";
      toast.error(message);
    }
  };

  const addMovie = async (listId: string, movieId: string) => {
    setAddingMovieToListId(listId);
    try {
      const response = await fetch(`/api/shared-lists/${listId}/movies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieId }),
      });

      await updateListsFromResponse(response);
      toast.success("Movie added to list");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not add movie.";
      toast.error(message);
    } finally {
      setAddingMovieToListId(null);
    }
  };

  const removeMovie = async (listId: string, movieId: string) => {
    setRemovingMovieFromListId(listId);
    try {
      const response = await fetch(`/api/shared-lists/${listId}/movies`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieId }),
      });

      await updateListsFromResponse(response);
      toast.success("Movie removed from list");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not remove movie.";
      toast.error(message);
    } finally {
      setRemovingMovieFromListId(null);
    }
  };

  return (
    <SharedListsView
      lists={lists}
      groups={groups}
      currentUser={currentUser}
      selectedList={selectedList}
      openCreate={openCreate}
      setOpenCreate={setOpenCreate}
      newName={newName}
      setNewName={setNewName}
      newDescription={newDescription}
      setNewDescription={setNewDescription}
      newVisibility={newVisibility}
      setNewVisibility={setNewVisibility}
      newGroupId={newGroupId}
      setNewGroupId={setNewGroupId}
      createList={createList}
      selectedListId={selectedListId}
      setSelectedListId={setSelectedListId}
      newCommentByList={newCommentByList}
      setNewCommentByList={setNewCommentByList}
      replyDrafts={replyDrafts}
      setReplyDrafts={setReplyDrafts}
      openReplyFor={openReplyFor}
      setOpenReplyFor={setOpenReplyFor}
      movieSearchQuery={movieSearchQuery}
      setMovieSearchQuery={setMovieSearchQuery}
      movieSearchResults={movieSearchResults}
      movieSearchLoading={movieSearchLoading}
      movieSearchError={movieSearchError}
      addingMovieToListId={addingMovieToListId}
      removingMovieFromListId={removingMovieFromListId}
      toggleLike={toggleLike}
      removeList={removeList}
      addComment={addComment}
      addMovie={addMovie}
      removeMovie={removeMovie}
    />
  );
}
