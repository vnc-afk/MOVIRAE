"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { generateOpId, attachOpToBody, attachOpToHeaders, makeTempId, reconcileTempItem } from "@/lib/optimistic";
import { useOptimisticOps } from "@/hooks/useOptimisticOps";
import type { SharedList } from "@/app/shared-lists/lib/types";
import type { Group } from "@/app/groups/lib/types";
import { queryKeys } from "@/lib/queryKeys";
import { SharedListsSnapshot, SharedListsResponse, NewListFormState } from "../lib/types";
import { constructUserProfile } from "../lib/shared-lists-utils";

// Default empty snapshot shapes the cache when no data exists yet.
const EMPTY_SNAPSHOT: SharedListsSnapshot = {
  lists: [],
  groups: [],
  currentUser: null,
  page: 1,
  hasMore: false,
};

const SHARED_LISTS_KEY = [queryKeys.sharedLists.all()] as const;

const applyEntityUpdate = <T>(
  queryClient: QueryClient,
  key: readonly unknown[],
  updater: (current: T | undefined) => T | undefined
) => {
  queryClient.setQueryData<T>(key, updater);
};

/*
  Helper to parse responses from the server that sometimes return an empty body.
  - Some API routes may respond with an empty body on errors; handle that gracefully.
  - We throw an error if the body is present but not valid JSON to surface unexpected server bugs.
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

export function useSharedListsSnapshot() {
  const query = useQuery<SharedListsSnapshot>({
    queryKey: SHARED_LISTS_KEY,
    queryFn: async () => {
      const listsResponse = await fetch("/api/shared-lists?page=1", { cache: "no-store" });
      const listsPayload = (await parseResponsePayload(listsResponse)) as SharedListsResponse | null;

      if (!listsResponse.ok) {
        throw new Error(listsPayload?.error || "Failed to load shared lists.");
      }

      const nextLists = Array.isArray(listsPayload?.value) ? listsPayload.value : [];
      const currentUser = constructUserProfile(listsPayload?.currentUser, nextLists);

      return {
        lists: nextLists,
        groups: [],
        currentUser,
        page: 1,
        hasMore: Boolean(listsPayload?.hasMore),
      };
    },
    enabled: true,
    refetchOnMount: true,
  });

  // Expose the snapshot and a loading flag to callers/components.
  return {
    snapshot: query.data ?? EMPTY_SNAPSHOT,
    isLoading: query.isLoading,
  };
}

export function useLoadSharedLists() {
  const queryClient = useQueryClient();

  return async () => {
    const response = await fetch("/api/shared-lists?page=1", { cache: "no-store" });
    const payload = (await parseResponsePayload(response)) as SharedListsResponse | null;

    if (!response.ok) {
      throw new Error(payload?.error || "Failed to load shared lists.");
    }

    const nextLists = Array.isArray(payload?.value) ? payload.value : [];
    const snapshot = queryClient.getQueryData<SharedListsSnapshot>(SHARED_LISTS_KEY);

    // Update the react-query cache with newly loaded lists while preserving groups and other metadata.
    queryClient.setQueryData<SharedListsSnapshot>(SHARED_LISTS_KEY, () => ({
      lists: nextLists,
      groups: snapshot?.groups ?? [],
      currentUser:
        payload?.currentUser?.id
          ? constructUserProfile(payload.currentUser, nextLists)
          : snapshot?.currentUser ?? null,
      page: 1,
      hasMore: Boolean(payload?.hasMore),
    }));

    return nextLists;
  };
}

export function useLoadGroups() {
  const queryClient = useQueryClient();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [hasLoaded, setHasLoaded] = useState(false);

  /*
    Load groups once and merge them into the shared-lists snapshot.
    - The `hasLoaded` guard prevents duplicate requests.
    - On success we patch the snapshot so UI components get groups synchronously.
  */
  const loadGroups = useCallback(async () => {
    if (hasLoaded || isLoading) {
      return groups;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/groups", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));

      const nextGroups = Array.isArray(payload.value) ? payload.value : [];
      setGroups(nextGroups);
      setHasLoaded(true);

      // Merge groups into the central snapshot cache so consumers don't need a separate query.
      queryClient.setQueryData<SharedListsSnapshot>(SHARED_LISTS_KEY, (current: SharedListsSnapshot | undefined) => {
        if (!current) return current;
        return { ...current, groups: nextGroups };
      });

      return nextGroups;
    } catch (error) {
      toast.error("Could not load groups.");
      return groups;
    } finally {
      setIsLoading(false);
    }
  }, [hasLoaded, isLoading, groups, queryClient]);

  return { groups, loadGroups, isLoading };
}

export function useLoadMoreSharedLists(snapshot: SharedListsSnapshot) {
  const queryClient = useQueryClient();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Pagination helper: fetch the next page and merge results without duplicating existing lists.
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !snapshot.hasMore) return;

    setIsLoadingMore(true);
    try {
      const nextPage = snapshot.page + 1;
      const response = await fetch(`/api/shared-lists?page=${nextPage}`, { cache: "no-store" });
      const payload = (await parseResponsePayload(response)) as SharedListsResponse | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load more lists.");
      }

      const additionalLists = Array.isArray(payload?.value) ? payload.value : [];

      // Merge new lists while preserving existing ones (avoid duplicates by ID).
      queryClient.setQueryData<SharedListsSnapshot>(SHARED_LISTS_KEY, (current: SharedListsSnapshot | undefined) => {
        if (!current) return current;

        const existingIds = new Set(current.lists.map((l) => l.id));
        const merged = [...current.lists, ...additionalLists.filter((l: any) => !existingIds.has(l.id))];
        return {
          ...current,
          lists: merged,
          page: nextPage,
          hasMore: Boolean(payload?.hasMore),
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load more lists.";
      toast.error(message);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, snapshot.hasMore, snapshot.page, queryClient]);

  return { loadMore, isLoadingMore };
}

export function useSharedListsEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let isActive = true;
    const eventSource = new EventSource("/api/shared-lists/events");

    // Listen to server-sent events that inform of list creates/updates/deletes.
    eventSource.addEventListener("shared-list-updated", (ev) => {
      if (!isActive) return;

      try {
        const payload = JSON.parse((ev as MessageEvent).data || "{}");
        const incomingOpId = typeof payload?.opId === "string" ? payload.opId : undefined;
        const action = typeof payload?.action === "string" ? payload.action : undefined;
        const serverList = payload?.list ?? null;
        const serverListId = typeof payload?.listId === "string" ? payload.listId : undefined;

        // Handle deletion notifications by filtering the list out of the cache.
        if (action === "deleted") {
          const targetListId = serverList?.id ?? serverListId;
          if (!targetListId) return;

          queryClient.setQueryData<SharedListsSnapshot>(SHARED_LISTS_KEY, (current: SharedListsSnapshot | undefined) => {
            if (!current) return current;
            return { ...current, lists: current.lists.filter((list: any) => list.id !== targetListId) };
          });
          return;
        }

        // When the server provides a canonical list object, update or merge it into cache.
        if (serverList) {
          const lists = queryClient.getQueryData<SharedListsSnapshot>(SHARED_LISTS_KEY)?.lists ?? [];

          // If the SSE includes an `opId` for an optimistic create, attempt to reconcile the temp item.
          if (incomingOpId) {
            const tempList = lists.find(
              (list) => (list as any).opId === incomingOpId || (list as any).tempId === incomingOpId
            ) as any;
            if (tempList) {
              const reconciled = reconcileTempItem(
                lists,
                { opId: incomingOpId, type: "create" as const, tempId: tempList.tempId, ts: Date.now() },
                serverList
              );
              applyEntityUpdate(queryClient, SHARED_LISTS_KEY, (current: SharedListsSnapshot | undefined) => {
                if (!current) return current;
                return { ...current, lists: reconciled as any };
              });
              return;
            }
          }

          // Otherwise, perform a simple replace-by-id of the incoming serverList.
          const nextLists = lists.map((list: any) => (list.id === serverList.id ? serverList : list));
          const finalLists =
            action === "created" && !nextLists.some((list: any) => list.id === serverList.id)
              ? [serverList, ...lists]
              : nextLists;

          // Apply final merged lists back into the shared-lists snapshot cache.
          applyEntityUpdate(queryClient, SHARED_LISTS_KEY, (current: SharedListsSnapshot | undefined) => {
            if (!current) return current;
            return { ...current, lists: finalLists as any };
          });
          return;
        }

        console.warn("Shared list SSE payload missing canonical list:", payload);
      } catch (err) {
        console.error("Failed to process shared list SSE payload:", err);
      }
    });

    // Keep SSE connection open; basic error handler is a no-op here. Consumer may re-open later.
    eventSource.onerror = () => {
    };

    return () => {
      isActive = false;
      eventSource.close();
    };
  }, [queryClient]);
}

export function useCreateList(snapshot: SharedListsSnapshot) {
  const { isInFlight, addInFlightOp, removeInFlightOp } = useOptimisticOps();
  const queryClient = useQueryClient();

  return async (form: NewListFormState) => {
    const { name, description, visibility, groupId: newGroupId } = form;
    const { currentUser, groups } = snapshot;

    if (!currentUser) {
      throw new Error("No active user profile available.");
    }

    if (!name.trim()) {
      throw new Error("List name is required.");
    }

    if (visibility === "group" && !newGroupId) {
      throw new Error("Please select a group for group visibility.");
    }

    // id used by optimistic ops system to block duplicate creates while one is in flight
    const createInFlightOpId = "shared-list-create";
    if (isInFlight(createInFlightOpId)) {
      return;
    }

    const tempId = makeTempId("list");
    // Build an optimistic op so the UI shows the new list immediately.
    const op = { opId: generateOpId("list"), type: "create" as const, tempId, ts: Date.now() };

    addInFlightOp(createInFlightOpId, {
      opId: createInFlightOpId,
      type: "create",
      surface: "shared-list",
      itemId: tempId,
    });


    const matchedGroup = newGroupId ? groups.find((g: any) => g.id === newGroupId) : null;

    // Construct an optimistic list entry to insert into the cache while the network request runs.
    const optimisticList = {
      id: tempId,
      tempId,
      opId: op.opId,
      name: name.trim(),
      description: description.trim(),
      visibility,
      groupId: newGroupId || undefined,
      groupName: matchedGroup?.name,
      owner: currentUser,
      collaborators: [],
      movies: [],
      commentItems: [],
      comments: 0,
      likes: 0,
      likedByMe: false,
      createdAt: new Date().toISOString(),
    } as any;

    applyEntityUpdate(queryClient, SHARED_LISTS_KEY, (current: SharedListsSnapshot | undefined) => {
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

      // If the server returned a created list that matches the optimistic one, reconcile it.
      if (serverCreated) {
        applyEntityUpdate(queryClient, SHARED_LISTS_KEY, (current: SharedListsSnapshot | undefined) => {
          if (!current) return current;
          return { ...current, lists: reconcileTempItem(current.lists, op, serverCreated) as any };
        });
      } else {
        applyEntityUpdate(queryClient, SHARED_LISTS_KEY, (current: SharedListsSnapshot | undefined) => {
          if (!current) return current;
          return { ...current, lists: nextLists };
        });
      }

      toast.success("Shared list created");
    } catch (error) {
      applyEntityUpdate(queryClient, SHARED_LISTS_KEY, (current: SharedListsSnapshot | undefined) => {
        if (!current) return current;
        return { ...current, lists: current.lists.filter((list: SharedList) => list.id !== tempId) };
      });
      const message = error instanceof Error ? error.message : "Could not create the list.";
      toast.error(message);
      throw error;
    } finally {
      removeInFlightOp(createInFlightOpId);
    }
  };
}

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

    // Keep a reference to the previous lists for rollback in case of network failure.
    const previousLists = snapshot.lists;
    const originalLikes = snapshot.lists.find((item) => item.id === list.id)?.likes ?? 0;
    const currentLiked = Boolean(snapshot.lists.find((item) => item.id === list.id)?.likedByMe);
    const nextLiked = !currentLiked;
    const optimisticLikes = nextLiked ? originalLikes + 1 : Math.max(originalLikes - 1, 0);

    applyEntityUpdate(queryClient, SHARED_LISTS_KEY, (current: SharedListsSnapshot | undefined) => {
      if (!current) return current;
      return {
        ...current,
        lists: current.lists.map((item: any) =>
          item.id === list.id ? { ...item, likedByMe: nextLiked, likes: optimisticLikes } : item
        ),
      };
    });

    // Attach an op id to the network request so server events can reconcile optimistic changes.
    const op = { opId: generateOpId("shared-list-like"), type: "like" as const, itemId: list.id, ts: Date.now() };

    try {
      const headers = attachOpToHeaders({ "Content-Type": "application/json" }, op);
      const response = await fetch(`/api/shared-lists/${list.id}/like`, {
        method: "POST",
        headers,
        body: JSON.stringify(attachOpToBody({}, op)),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update like");
      }

      const serverList = Array.isArray(payload?.value) ? payload.value[0] : payload?.value;

      if (serverList) {
        applyEntityUpdate(queryClient, SHARED_LISTS_KEY, (current: SharedListsSnapshot | undefined) => {
          if (!current) return current;

          const nextLists = current.lists.map((item) => (item.id === serverList.id ? { ...item, ...serverList } : item));

          return {
            ...current,
            lists: nextLists.some((item) => item.id === serverList.id) ? nextLists : [serverList, ...current.lists],
          };
        });

        await queryClient.invalidateQueries({ queryKey: SHARED_LISTS_KEY });
      }
    } catch (error) {
      applyEntityUpdate(queryClient, SHARED_LISTS_KEY, (current: SharedListsSnapshot | undefined) => {
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

export function useRemoveList(snapshot: SharedListsSnapshot) {
  const { isInFlight, addInFlightOp, removeInFlightOp } = useOptimisticOps();
  const queryClient = useQueryClient();

  return async (id: string, onDeleted?: () => void) => {
    // Block concurrent deletes by tracking an in-flight op with a unique id.
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

    applyEntityUpdate(queryClient, SHARED_LISTS_KEY, (current: SharedListsSnapshot | undefined) => {
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
      applyEntityUpdate(queryClient, SHARED_LISTS_KEY, (current: SharedListsSnapshot | undefined) => {
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