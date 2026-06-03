"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { generateOpId, attachOpToBody, attachOpToHeaders, makeTempId, reconcileTempItem } from "@/lib/optimistic";
import { searchMovies } from "@/lib/tmdb";
import { useOptimisticOps } from "@/hooks/useOptimisticOps";
import type { Movie, SharedList } from "@/lib/types";
import { queryKeys } from "@/lib/queryKeys";
import { applyEntityUpdate } from "@/lib/cacheHelpers";
import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";
import { SharedListsSnapshot, SharedListsResponse, MovieSearchState, NewListFormState } from "../lib/types";
import { constructUserProfile, appendReplyToComments } from "../lib/shared-lists-utils";

const EMPTY_SNAPSHOT: SharedListsSnapshot = {
  lists: [],
  groups: [],
  currentUser: null,
};

/**
 * Load shared lists and groups data
 */
export function useSharedListsSnapshot() {
  const queryClient = useQueryClient();

  const query = usePrefetchAwareQuery<SharedListsSnapshot>({
    queryKey: queryKeys.sharedLists.all(),
    queryFn: async () => {
      const [listsResponse, groupsResponse] = await Promise.all([
        fetch("/api/shared-lists", { cache: "no-store" }),
        fetch("/api/groups", { cache: "no-store" }),
      ]);

      const listsPayload = (await parseResponsePayload(listsResponse)) as SharedListsResponse | null;
      const groupsPayload = await groupsResponse.json().catch(() => ({}));

      if (!listsResponse.ok) {
        throw new Error(listsPayload?.error || "Failed to load shared lists.");
      }

      const nextLists = Array.isArray(listsPayload?.value) ? listsPayload.value : [];
      const currentUser = constructUserProfile(listsPayload?.currentUser, nextLists);

      return {
        lists: nextLists,
        groups: Array.isArray(groupsPayload.value) ? groupsPayload.value : [],
        currentUser,
      };
    },
    enabled: true,
  });

  return {
    snapshot: query.data ?? EMPTY_SNAPSHOT,
    isLoading: query.isLoading,
  };
}

/**
 * Helper to parse API responses
 */
async function parseResponsePayload(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as { value?: unknown; error?: string };
  } catch {
    throw new Error("Received an invalid server response.");
  }
}

/**
 * Refresh shared lists from server
 */
export function useLoadSharedLists() {
  const queryClient = useQueryClient();

  return async () => {
    const response = await fetch("/api/shared-lists", { cache: "no-store" });
    const payload = (await parseResponsePayload(response)) as SharedListsResponse | null;

    if (!response.ok) {
      throw new Error(payload?.error || "Failed to load shared lists.");
    }

    const nextLists = Array.isArray(payload?.value) ? payload.value : [];
    const snapshot = queryClient.getQueryData<SharedListsSnapshot>([queryKeys.sharedLists.all()]);

    applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], () => ({
      lists: nextLists,
      groups: snapshot?.groups ?? [],
      currentUser:
        payload?.currentUser?.id
          ? constructUserProfile(payload.currentUser, nextLists)
          : snapshot?.currentUser ?? null,
    }));

    return nextLists;
  };
}

/**
 * Load groups data
 */
export function useLoadGroups() {
  const queryClient = useQueryClient();

  return async () => {
    const groupsResponse = await fetch("/api/groups", { cache: "no-store" }).then((response) => response.json());
    applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
      if (!current) return current;
      return { ...current, groups: Array.isArray(groupsResponse.value) ? groupsResponse.value : [] };
    });
  };
}

/**
 * Listen for real-time shared list updates via EventSource
 */
export function useSharedListsEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let isActive = true;
    const eventSource = new EventSource("/api/shared-lists/events");

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
              return { ...current, lists: current.lists.filter((list: any) => list.id !== targetListId) };
            });
          } catch (e) {
            /* best-effort */
          }
          return;
        }

        if (serverList) {
          const lists = queryClient.getQueryData<SharedListsSnapshot>([queryKeys.sharedLists.all()])?.lists ?? [];

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

          const nextLists = lists.map((list: any) => (list.id === serverList.id ? serverList : list));
          const finalLists = action === "created" && !nextLists.some((list: any) => list.id === serverList.id) ? [serverList, ...lists] : nextLists;
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
      // Browser retries automatically
    };

    return () => {
      isActive = false;
      eventSource.close();
    };
  }, [queryClient]);
}

/**
 * Create a new shared list
 */
export function useCreateList(snapshot: SharedListsSnapshot) {
  const { isInFlight, addInFlightOp, removeInFlightOp } = useOptimisticOps();
  const queryClient = useQueryClient();

  return async (form: NewListFormState) => {
    const { name, description, visibility, groupId: newGroupId } = form;
    const { currentUser, groups, lists } = snapshot;

    if (!currentUser) {
      throw new Error("No active user profile available.");
    }

    if (!name.trim()) {
      throw new Error("List name is required.");
    }

    if (visibility === "group" && !newGroupId) {
      throw new Error("Please select a group for group visibility.");
    }

    const createInFlightOpId = "shared-list-create";
    if (isInFlight(createInFlightOpId)) {
      return;
    }

    const tempId = makeTempId("list");
    const op = { opId: generateOpId("list"), type: "create" as const, tempId, ts: Date.now() };

    addInFlightOp(createInFlightOpId, {
      opId: createInFlightOpId,
      type: "create",
      surface: "shared-list",
      itemId: tempId,
    });

    const optimisticList = {
      id: tempId,
      tempId,
      opId: op.opId,
      name: name.trim(),
      description: description.trim(),
      visibility,
        groups: newGroupId ? groups.find((g: any) => g.id === newGroupId) ?? null : null,
      owner: currentUser,
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
      const body = attachOpToBody(
        { name: name.trim(), description: description.trim(), visibility, groupId: newGroupId || undefined },
        op
      );
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
      const serverCreated = nextLists.find(
        (l: any) => l.name === optimisticList.name && l.owner?.id === optimisticList.owner.id && !String(l.id).startsWith("temp-")
      );

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

      toast.success("Shared list created");
    } catch (error) {
      applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
        if (!current) return current;
        return { ...current, lists: current.lists.filter((list: SharedList) => list.id !== tempId) };
      });
      throw error;
    } finally {
      removeInFlightOp(createInFlightOpId);
    }
  };
}

/**
 * Like/unlike a shared list
 */
export function useToggleLike(snapshot: SharedListsSnapshot) {
  const { isInFlight, addInFlightOp, removeInFlightOp } = useOptimisticOps();
  const queryClient = useQueryClient();

  return async (list: SharedList) => {
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

    const previousLists = snapshot.lists;
    const originalLikes = snapshot.lists.find((item) => item.id === list.id)?.likes ?? 0;
    const currentLiked = Boolean(snapshot.lists.find((item) => item.id === list.id)?.likedByMe);
    const nextLiked = !currentLiked;
    const optimisticLikes = nextLiked ? originalLikes + 1 : Math.max(originalLikes - 1, 0);

    applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
      if (!current) return current;
      return {
        ...current,
        lists: current.lists.map((item: any) =>
          item.id === list.id ? { ...item, likedByMe: nextLiked, likes: optimisticLikes } : item
        ),
      };
    });

    const op = { opId: generateOpId("shared-list-like"), type: "like" as const, itemId: list.id, ts: Date.now() };

    try {
      const headers = attachOpToHeaders({ "Content-Type": "application/json" }, op);
      const response = await fetch(`/api/shared-lists/${list.id}/like`, {
        method: "POST",
        headers,
        body: JSON.stringify(attachOpToBody({}, op)),
      });

      if (!response.ok) {
        throw new Error("Failed to update like");
      }
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
}

/**
 * Delete a shared list
 */
export function useRemoveList(snapshot: SharedListsSnapshot) {
  const { isInFlight, addInFlightOp, removeInFlightOp } = useOptimisticOps();
  const queryClient = useQueryClient();

  return async (id: string, onDeleted?: () => void) => {
    const deleteInFlightOpId = `shared-list-delete-${id}`;
    if (isInFlight(deleteInFlightOpId)) {
      return;
    }

    const previousLists = snapshot.lists;

    addInFlightOp(deleteInFlightOpId, {
      opId: deleteInFlightOpId,
      type: "delete",
      surface: "shared-list",
      itemId: id,
    });

    applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
      if (!current) return current;
      return {
        ...current,
        lists: current.lists.filter((list) => list.id !== id),
      };
    });

    try {
      const op = { opId: generateOpId("shared-list-delete"), type: "delete" as const, itemId: id, ts: Date.now() };
      const body = attachOpToBody({}, op);
      const headers = attachOpToHeaders({ "Content-Type": "application/json" }, op);

      const response = await fetch(`/api/shared-lists/${id}`, {
        method: "DELETE",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = await parseResponsePayload(response);
        throw new Error(payload?.error || "Could not remove the list.");
      }

      onDeleted?.();
      toast.success("List removed");
    } catch (error) {
      applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
        if (!current) return current;
        return { ...current, lists: previousLists };
      });
      const message = error instanceof Error ? error.message : "Could not remove the list.";
      toast.error(message);
    } finally {
      removeInFlightOp(deleteInFlightOpId);
    }
  };
}
