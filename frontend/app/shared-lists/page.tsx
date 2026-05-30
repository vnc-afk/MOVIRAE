"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { generateOpId, attachOpToBody, attachOpToHeaders, makeTempId, reconcileTempItem } from "@/lib/optimistic";
import { searchMovies } from "@/lib/tmdb";
import { useOptimisticOps } from "@/hooks/useOptimisticOps";
import type { Group, Movie, SharedList, UserProfile } from "@/lib/types";
import { SharedListsView } from "./shared-lists-view";
import { queryKeys } from "@/lib/queryKeys";
import { applyEntityUpdate } from "@/lib/cacheHelpers";
import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";

type SharedListsResponse = {
  value?: SharedList[];
  currentUser?: Pick<UserProfile, "id" | "email"> | null;
  error?: string;
};

type SharedListsSnapshot = {
  lists: SharedList[];
  groups: Group[];
  currentUser: UserProfile | null;
};

const EMPTY_SHARED_LISTS_SNAPSHOT: SharedListsSnapshot = {
  lists: [],
  groups: [],
  currentUser: null,
};

export default function SharedListsPage() {
  const searchParams = useSearchParams();
  const { isInFlight, addInFlightOp, removeInFlightOp } = useOptimisticOps();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const queryClient = useQueryClient();

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

  const sharedListsQuery = usePrefetchAwareQuery<SharedListsSnapshot>({
    queryKey: queryKeys.sharedLists.all(),
    queryFn: async () => {
      const [listsResponse, groupsResponse] = await Promise.all([
        fetch("/api/shared-lists", { cache: "no-store" }),
        fetch("/api/data/groups", { cache: "no-store" }),
      ]);

      const listsPayload = (await parseResponsePayload(listsResponse)) as SharedListsResponse | null;
      const groupsPayload = await groupsResponse.json().catch(() => ({}));

      if (!listsResponse.ok) {
        throw new Error(listsPayload?.error || "Failed to load shared lists.");
      }

      const nextLists = Array.isArray(listsPayload?.value) ? listsPayload.value : [];
      const authenticatedUser = listsPayload?.currentUser;
      const currentUser = authenticatedUser?.id
        ? (
            nextLists.find((list) => list.owner.id === authenticatedUser.id)?.owner ??
            nextLists.flatMap((list) => list.collaborators).find((collaborator) => collaborator.id === authenticatedUser.id) ??
            {
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
          )
        : null;

      return {
        lists: nextLists,
        groups: Array.isArray(groupsPayload.value) ? groupsPayload.value : [],
        currentUser,
      };
    },
    enabled: true,
  });

  const snapshot = sharedListsQuery.data ?? EMPTY_SHARED_LISTS_SNAPSHOT;
  const lists = snapshot.lists;
  const groups = snapshot.groups;
  const currentUser = snapshot.currentUser;

  const selectedList = useMemo(() => lists.find((list) => list.id === selectedListId) ?? null, [lists, selectedListId]);

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
    applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], () => ({
      lists: nextLists,
      groups: snapshot.groups,
      currentUser:
        payload?.currentUser?.id
          ? (
              nextLists.find((list) => list.owner.id === payload.currentUser?.id)?.owner ??
              nextLists.flatMap((list) => list.collaborators).find((collaborator) => collaborator.id === payload.currentUser?.id) ??
              snapshot.currentUser ??
              {
                id: payload.currentUser.id,
                email: payload.currentUser.email,
                username: payload.currentUser.email?.split("@")[0] ?? "user",
                displayName: payload.currentUser.email?.split("@")[0] ?? "User",
                avatar: "",
                bio: "",
                followers: 0,
                following: 0,
                reviewCount: 0,
                watchlistCount: 0,
                favoriteMovies: [],
              }
            )
          : null,
    }));
    return nextLists;
  };

  const loadSupportingData = async () => {
    const groupsResponse = await fetch("/api/data/groups", { cache: "no-store" }).then((response) => response.json());
    applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
      if (!current) return current;
      return { ...current, groups: Array.isArray(groupsResponse.value) ? groupsResponse.value : [] };
    });
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
    eventSource.addEventListener("shared-list-updated", (ev) => {
      if (!isActive) return;

      try {
        const payload = JSON.parse((ev as MessageEvent).data || "{}");
        const incomingOpId = typeof payload?.opId === "string" ? payload.opId : undefined;

        const action = typeof payload?.action === "string" ? payload.action : undefined;
        const serverList = payload?.list ?? null;
        const serverListId = typeof payload?.listId === "string" ? payload.listId : undefined;

        if (action === "deleted") {
          const targetListId = serverList?.id ?? serverListId;
          if (!targetListId) return;

          try {
            applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
              if (!current) return current;
              return { ...current, lists: current.lists.filter((list) => list.id !== targetListId) };
            });
          } catch (e) {
            /* best-effort */
          }
          return;
        }

        if (serverList) {
          if (incomingOpId) {
            const tempList = lists.find((list) => (list as any).opId === incomingOpId || (list as any).tempId === incomingOpId) as any;
            if (tempList) {
              const reconciled = reconcileTempItem(
                lists,
                { opId: incomingOpId, type: "create" as const, tempId: tempList.tempId, ts: Date.now() },
                serverList
              );
              try {
                applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
                  if (!current) return current;
                  return { ...current, lists: reconciled as any };
                });
              } catch (e) {
                /* best-effort */
              }
              return;
            }
          }

          const nextLists = lists.map((list) => (list.id === serverList.id ? serverList : list));
          const finalLists = action === "created" && !nextLists.some((list) => list.id === serverList.id) ? [serverList, ...lists] : nextLists;
          try {
            applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
              if (!current) return current;
              return { ...current, lists: finalLists as any };
            });
          } catch (e) {
            /* best-effort */
          }
          return;
        }

        console.warn("Shared list SSE payload missing canonical list:", payload);
      } catch (err) {
        console.error("Failed to process shared list SSE payload:", err);
      }
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

    const tempId = makeTempId("list");
    const op = { opId: generateOpId("list"), type: "create" as const, tempId, ts: Date.now() };

    const optimisticList = {
      id: tempId,
      tempId,
      opId: op.opId,
      name: newName.trim(),
      description: newDescription.trim(),
      visibility: newVisibility,
      group: newGroupId ? groups.find((g) => g.id === newGroupId) ?? null : null,
      owner: currentUser!,
      collaborators: [],
      movies: [],
      commentItems: [],
      comments: 0,
      likes: 0,
      likedByMe: false,
    } as any;

    applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
      if (!current) return current;
      return { ...current, lists: [optimisticList, ...current.lists] };
    });

    try {
      const body = attachOpToBody({ name: newName.trim(), description: newDescription.trim(), visibility: newVisibility, groupId: newGroupId || undefined }, op);
      const headers = attachOpToHeaders({ "Content-Type": "application/json" }, op);

      const response = await fetch("/api/shared-lists", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create list.");
      }

      const nextLists = Array.isArray(payload?.value) ? payload.value : [];

      // try to reconcile the temp item with the server-created one
      const serverCreated = nextLists.find((l: any) => l.name === optimisticList.name && l.owner?.id === optimisticList.owner.id && !String(l.id).startsWith("temp-"));
      if (serverCreated) {
        applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
          if (!current) return current;
          return { ...current, lists: reconcileTempItem(current.lists, op, serverCreated) as any };
        });
      } else {
        applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
          if (!current) return current;
          return { ...current, lists: nextLists };
        });
      }

      setNewName("");
      setNewDescription("");
      setNewVisibility("public");
      setNewGroupId("");
      setOpenCreate(false);

      toast.success("Shared list created");
    } catch (error) {
      applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
        if (!current) return current;
        return { ...current, lists: current.lists.filter((list: SharedList) => list.id !== tempId) };
      });
      const message = error instanceof Error ? error.message : "Failed to create list.";
      toast.error(message);
    }
  };

  type SharedListComment = NonNullable<SharedList["commentItems"]>[number];

  const appendReplyToComments = (
    comments: SharedListComment[],
    parentId: string,
    reply: SharedListComment
  ): SharedListComment[] => {
    return comments.map((comment) => {
      if (comment.id === parentId) {
        return {
          ...comment,
          replies: [...comment.replies, reply],
        };
      }

      return {
        ...comment,
        replies: appendReplyToComments(comment.replies, parentId, reply),
      };
    });
  };

  const updateListsFromResponse = async (response: Response) => {
    const payload = await parseResponsePayload(response);

    if (!response.ok) {
      throw new Error(payload?.error || "Request failed.");
    }

    const nextLists = Array.isArray(payload?.value) ? payload.value : [];
    applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
      if (!current) return current;
      return { ...current, lists: nextLists };
    });
    return nextLists;
  };

  const mutateList = async (
    listId: string,
    endpoint: string,
    body?: Record<string, unknown>,
    op?: any,
    method: "POST" | "DELETE" = "POST"
  ) => {
    const bodyObj = op ? attachOpToBody(body, op) : body;
    const headers = op
      ? attachOpToHeaders({ "Content-Type": "application/json" }, op)
      : { "Content-Type": "application/json" };

    const response = await fetch(`/api/shared-lists/${listId}/${endpoint}`, {
      method,
      headers,
      body: bodyObj ? JSON.stringify(bodyObj) : undefined,
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
    const opId = `shared-list-like-${list.id}`;
    if (isInFlight(opId)) {
      return;
    }

    addInFlightOp(opId, {
      opId,
      type: "like",
      surface: "shared-list",
      itemId: list.id,
    });

    const previousLists = lists;

    // Compute original likes from current state to avoid double increments
    const originalLikes = lists.find((item) => item.id === list.id)?.likes ?? 0;
    const currentLiked = Boolean(lists.find((item) => item.id === list.id)?.likedByMe);
    const nextLiked = !currentLiked;
    const optimisticLikes = nextLiked ? originalLikes + 1 : Math.max(originalLikes - 1, 0);

    applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
      if (!current) return current;
      return {
        ...current,
        lists: current.lists.map((item) =>
          item.id === list.id ? { ...item, likedByMe: nextLiked, likes: optimisticLikes } : item
        ),
      };
    });

    const op = { opId: generateOpId("shared-list-like"), type: "like" as const, itemId: list.id, ts: Date.now() };

    try {
      await mutateList(list.id, "like", undefined, op, "POST");
    } catch (error) {
      applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
        if (!current) return current;
        return { ...current, lists: previousLists };
      });
      const message = error instanceof Error ? error.message : "Could not update the like.";
      toast.error(message);
    } finally {
      removeInFlightOp(opId);
    }
  };

  const addComment = async (listId: string, parentId?: string) => {
    if (!currentUser) {
      toast.error("Sign in to comment.");
      return;
    }

    const body = (parentId ? replyDrafts[parentId] : newCommentByList[listId])?.trim();
    if (!body) {
      toast.error("Comment cannot be empty.");
      return;
    }

    const opId = parentId ? `shared-list-reply-${parentId}` : `shared-list-comment-${listId}`;
    if (isInFlight(opId)) {
      return;
    }

    addInFlightOp(opId, {
      opId,
      type: parentId ? "reply" : "post",
      surface: "shared-list",
      itemId: listId,
      parentId,
      payload: { body, parentId },
    });

    const previousLists = lists;
    const tempCommentId = makeTempId("comment");
    const op = { opId: generateOpId("shared-list-comment"), type: "create" as const, tempId: tempCommentId, ts: Date.now() };
    const optimisticComment: any = {
      id: tempCommentId,
      tempId: tempCommentId,
      opId: op.opId,
      user: currentUser,
      body,
      date: new Date().toISOString(),
      parentId: parentId ?? null,
      replies: [],
    };

    applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
      if (!current) return current;

      return {
        ...current,
        lists: current.lists.map((item) => {
          if (item.id !== listId) {
            return item;
          }

          const existingComments = item.commentItems ?? [];
          const updatedComments = parentId
            ? appendReplyToComments(existingComments, parentId, optimisticComment)
            : [...existingComments, optimisticComment];

          return {
            ...item,
            commentItems: updatedComments,
            comments: (item.comments ?? 0) + 1,
          };
        }),
      };
    });

    try {
      const bodyObj = attachOpToBody({ body, parentId }, op);
      const headers = attachOpToHeaders({ "Content-Type": "application/json" }, op);

      const response = await fetch(`/api/shared-lists/${listId}/comments`, {
        method: "POST",
        headers,
        body: JSON.stringify(bodyObj),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Could not post the comment.");
      }

      // server returns canonical lists array; set it to keep state consistent
      const nextLists = Array.isArray(payload?.value) ? payload.value : [];
      applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
        if (!current) return current;
        return { ...current, lists: nextLists };
      });

      if (parentId) {
        setReplyDrafts((current) => ({ ...current, [parentId]: "" }));
        setOpenReplyFor(null);
      } else {
        setNewCommentByList((current) => ({ ...current, [listId]: "" }));
      }

      toast.success(parentId ? "Reply posted" : "Comment posted");
    } catch (error) {
      applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
        if (!current) return current;
        return { ...current, lists: previousLists };
      });
      const message = error instanceof Error ? error.message : "Could not post the comment.";
      toast.error(message);
    } finally {
      removeInFlightOp(opId);
    }
  };

  const addMovie = async (listId: string, movieId: string) => {
    const previousLists = lists;
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

    setAddingMovieToListId(listId);
    const op = { opId: generateOpId("shared-list-add-movie"), type: "update" as const, itemId: listId, ts: Date.now() };

    try {
      await mutateList(listId, "movies", { movieId }, op, "POST");
      toast.success("Movie added to list");
    } catch (error) {
      applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
        if (!current) return current;
        return { ...current, lists: previousLists };
      });
      const message = error instanceof Error ? error.message : "Could not add movie.";
      toast.error(message);
    } finally {
      setAddingMovieToListId(null);
    }
  };

  const removeMovie = async (listId: string, movieId: string) => {
    const previousLists = lists;
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

    setRemovingMovieFromListId(listId);
    const op = { opId: generateOpId("shared-list-remove-movie"), type: "delete" as const, itemId: listId, ts: Date.now() };

    try {
      await mutateList(listId, "movies", { movieId }, op, "DELETE");
      toast.success("Movie removed from list");
    } catch (error) {
      applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
        if (!current) return current;
        return { ...current, lists: previousLists };
      });
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
      isInFlight={isInFlight}
      toggleLike={toggleLike}
      removeList={removeList}
      addComment={addComment}
      addMovie={addMovie}
      removeMovie={removeMovie}
    />
  );
}
