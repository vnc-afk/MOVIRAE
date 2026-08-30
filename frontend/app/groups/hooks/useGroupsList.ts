"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { fetchJson, parseApiResponse, ApiRequestError  } from "../lib/groupUtils";
import type { GroupRecord, GroupsSnapshot, GroupsResponse } from "../lib/types";

/**
 * Represents the typed error states used by the groups feature.
 */
export type GroupsError =
  | { type: 'NETWORK'; message: string }
  | { type: 'AUTH'; message: string }
  | { type: 'SERVER'; message: string }
  | { type: 'VALIDATION'; message: string };

/**
 * Builds a typed error object for a groups-related request.
 */
export function createGroupsError(type: GroupsError['type'], message: string): GroupsError {
  return { type, message };
}

function isGroupsError(err: unknown): err is GroupsError {
  return typeof err === "object" && err !== null && "type" in err && "message" in err;
}

/**
 * Loads the groups list and keeps the query cache aligned with the latest server response.
 */
export function useGroupsList() {
  const queryClient = useQueryClient();
  const cachedSnapshot = queryClient.getQueryData<GroupsSnapshot>(queryKeys.group.list());
  const [isLoading, setIsLoading] = useState(!cachedSnapshot);
  const [error, setError] = useState<GroupsError | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const MAX_RETRIES = 3;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

 const loadGroups = useCallback(async (page = 1) => {
  // Reset loading state so the UI can show a fresh fetch cycle.
  setIsLoading(true);
  setError(null);

  try {
    const result = await fetchJson<GroupsResponse>(`/api/groups?page=${page}&limit=20`);

    if (!result.ok) {
      if (result.status === 401) {
        throw createGroupsError('AUTH', 'Please sign in to view groups.');
      }
      if (result.status === 0) {
        throw createGroupsError('NETWORK', 'Failed to load groups. Please check your connection.');
      }
      throw createGroupsError('SERVER', `Failed to load groups (status ${result.status}).`);
    }

    const payload = result.data;
    // Merge newly fetched rows into the existing cache when paging through results.
    const newGroups: GroupRecord[] = Array.isArray(payload.value) ? payload.value : [];
    const currentUser = payload.currentUser ?? null;

    queryClient.setQueryData(queryKeys.group.list(), (current: GroupsSnapshot | undefined) => ({
      groups: page === 1 ? newGroups : [...(current?.groups ?? []), ...newGroups],
      currentUser,
      page,
      hasMore: payload.pagination?.hasMore ?? false,
    }));

    retryCountRef.current = 0;
    setError(null);
  } catch (err) {
    const groupsError = isGroupsError(err)
      ? err
      : createGroupsError('SERVER', err instanceof Error ? err.message : 'Unknown error occurred');

    if (isMountedRef.current) setError(groupsError);

    if (groupsError.type !== 'AUTH' && retryCountRef.current < MAX_RETRIES) {
      retryCountRef.current++;
      const delay = Math.pow(2, retryCountRef.current) * 1000;
      retryTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) loadGroups(page);
      }, delay);
    }

    console.error("Failed to load groups:", groupsError);
  } finally {
    if (isMountedRef.current) setIsLoading(false);
  }
}, [queryClient]);

const loadMore = useCallback(() => {
  const current = queryClient.getQueryData<GroupsSnapshot>(queryKeys.group.list());
  if (current?.hasMore) {
    loadGroups(current.page + 1);
  }
}, [queryClient, loadGroups]);

const snapshot = queryClient.getQueryData<GroupsSnapshot>(queryKeys.group.list()) ?? {
  groups: [],
  currentUser: null,
  page: 1,
  hasMore: false,
};

return {
  groups: snapshot.groups,
  currentUser: snapshot.currentUser,
  isLoading,
  error,
  refetch: loadGroups,
  loadMore,
  hasMore: snapshot.hasMore,
};
}

/**
 * Persists an updated groups snapshot back to the API.
 */
export function usePersistGroups() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<GroupsError | null>(null);

  const save = useCallback(
    async (nextGroups: GroupRecord[]): Promise<GroupRecord[]> => {
      setError(null);
      const previousSnapshot = queryClient.getQueryData<GroupsSnapshot>(queryKeys.group.list());

      try {
        queryClient.setQueryData(queryKeys.group.list(), (current: GroupsSnapshot | undefined) => {
          if (!current) return current;
          return { ...current, groups: nextGroups };
        });

        const response = await fetch("/api/groups", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextGroups),
        });

        if (!response.ok) {
          throw createGroupsError(
            response.status === 401 ? 'AUTH' : 'SERVER',
            `Failed to persist groups: ${response.status}`
          );
        }

        const payload = await response.json();
        const savedGroups: GroupRecord[] = Array.isArray(payload.value) ? payload.value : nextGroups;

        queryClient.setQueryData(queryKeys.group.list(), (current: GroupsSnapshot | undefined) => {
          if (!current) return current;
          return { ...current, groups: savedGroups };
        });

        return savedGroups;
      } catch (err) {
        if (previousSnapshot) {
          queryClient.setQueryData(queryKeys.group.list(), previousSnapshot);
        }

        const groupsError = isGroupsError(err)
          ? err
          : createGroupsError('SERVER', err instanceof Error ? err.message : 'Failed to save groups');

        setError(groupsError);
        throw groupsError;
      }
    },
    [queryClient]
  );

  return { save, error };
}

/**
 * Provides optimistic join and leave behavior for groups.
 */
export function useGroupMembership(
  onError?: (error: GroupsError) => void,
  onSuccess?: (action: 'joined' | 'left') => void
) {
  const queryClient = useQueryClient();
  const [isToggling, setIsToggling] = useState(false);

  const toggleJoin = useCallback(
    async (groupId: string): Promise<void> => {
      setIsToggling(true);
      const snapshot = queryClient.getQueryData<GroupsSnapshot>(queryKeys.group.list());

      if (!snapshot) {
        const error = createGroupsError('VALIDATION', 'Groups not loaded');
        onError?.(error);
        setIsToggling(false);
        throw error;
      }

      const { currentUser, groups } = snapshot;

      if (!currentUser) {
        const error = createGroupsError('AUTH', 'User must be signed in');
        onError?.(error);
        setIsToggling(false);
        throw error;
      }

      const group = groups.find((g) => g.id === groupId);
      if (!group) {
        const error = createGroupsError('VALIDATION', 'Group not found');
        onError?.(error);
        setIsToggling(false);
        throw error;
      }

      const isJoined = group.joined ?? false;
      // Apply the optimistic update first so the UI responds immediately.
      const previousSnapshot = snapshot;

      try {
        const nextGroups = groups.map((g) =>
          g.id === groupId
            ? {
                ...g,
                joined: !isJoined,
                members: !isJoined
                  ? [currentUser, ...(g.members ?? [])]
                  : (g.members ?? []).filter((m) => m.id !== currentUser.id),
                memberCount: !isJoined ? (g.memberCount ?? 0) + 1 : Math.max(0, (g.memberCount ?? 0) - 1),
              }
            : g
        );

        queryClient.setQueryData(queryKeys.group.list(), { ...snapshot, groups: nextGroups });

        const method = isJoined ? "DELETE" : "POST";
        const response = await fetch(`/api/groups/${groupId}/members`, {
          method,
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          throw createGroupsError(
            response.status === 401 ? 'AUTH' : 'SERVER',
            `Failed to ${isJoined ? "leave" : "join"} group`
          );
        }

        onSuccess?.(isJoined ? 'left' : 'joined');
      } catch (err) {
        queryClient.setQueryData(queryKeys.group.list(), previousSnapshot);

        const groupsError = isGroupsError(err) ? err : createGroupsError('SERVER', 'Failed to update membership');

        onError?.(groupsError);
        throw groupsError;
      } finally {
        setIsToggling(false);
      }
    },
    [queryClient, onError, onSuccess]
  );

  return { toggleJoin, isToggling };
}

function classifyError(err: unknown, fallbackMessage: string): GroupsError {
  if (err instanceof ApiRequestError) {
    if (err.status === 401) return createGroupsError('AUTH', err.message || 'Please sign in.');
    if (err.status === 0) return createGroupsError('NETWORK', 'Please check your connection.');
    if (err.status === 400) return createGroupsError('VALIDATION', err.message);
    return createGroupsError('SERVER', err.message);
  }
  if (isGroupsError(err)) return err;
  return createGroupsError('SERVER', err instanceof Error ? err.message : fallbackMessage);
}

/**
 * Creates a new group and prepends it to the cached list on success.
 */
export function useCreateGroup(
  onError?: (error: GroupsError) => void,
  onSuccess?: (group: GroupRecord) => void
) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const create = useCallback(
    async (name: string, description: string): Promise<GroupRecord> => {
      setIsCreating(true);
      const snapshot = queryClient.getQueryData<GroupsSnapshot>(queryKeys.group.list());

      if (!snapshot?.currentUser) {
        const error = createGroupsError('AUTH', 'User must be signed in');
        onError?.(error);
        setIsCreating(false);
        throw error;
      }

      const trimmedName = name.trim();
      const trimmedDesc = description.trim();

      if (!trimmedName || !trimmedDesc) {
        const error = createGroupsError('VALIDATION', 'Name and description are required');
        onError?.(error);
        setIsCreating(false);
        throw error;
      }

    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, description: trimmedDesc }),
      });


      const createdGroup = await parseApiResponse<GroupRecord>(response);

      queryClient.setQueryData(queryKeys.group.list(), (current: GroupsSnapshot | undefined) => {
        if (!current) return current;
        return { ...current, groups: [createdGroup, ...current.groups] };
      });

      onSuccess?.(createdGroup);
      return createdGroup;
    } catch (err) {
      const groupsError = classifyError(err, 'Failed to create group');
      onError?.(groupsError);
      throw groupsError;
    } finally {
      setIsCreating(false);
    }
    },
    [queryClient, onError, onSuccess]
  );

  return { create, isCreating };
}
  
