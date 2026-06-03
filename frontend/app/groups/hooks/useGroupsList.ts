"use client";

import { useCallback, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { applyEntityUpdate } from "@/lib/cacheHelpers";
import { fetchJsonValue } from "../lib/groupUtils";
import type { GroupRecord, GroupsSnapshot, GroupsResponse } from "../lib/types";
import type { UserProfile } from "@/lib/types";

// Error types for better error handling
export type GroupsError = 
  | { type: 'NETWORK'; message: string }
  | { type: 'AUTH'; message: string }
  | { type: 'SERVER'; message: string }
  | { type: 'VALIDATION'; message: string };

export function createGroupsError(type: GroupsError['type'], message: string): GroupsError {
  return { type, message };
}

/**
 * Hook: Load groups list
 * Single source of truth: queryClient cache
 * 
 * Responsibilities:
 * - Fetch groups from API
 * - Manage loading state
 * - Handle errors and retry logic
 * 
 * Usage:
 *   const { groups, currentUser, isLoading, error, refetch } = useGroupsList();
 */
export function useGroupsList() {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<GroupsError | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  const loadGroups = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const payload = await fetchJsonValue<GroupsResponse>("/api/groups");
      
      if (!payload) {
        throw createGroupsError('NETWORK', 'Failed to load groups. Please check your connection.');
      }

      const groups: GroupRecord[] = Array.isArray(payload.value) ? payload.value : [];
      const currentUser = payload.currentUser ?? null;
      const snapshot: GroupsSnapshot = { groups, currentUser };

      // Single source of truth: queryClient
      queryClient.setQueryData(queryKeys.group.list(), snapshot);
      retryCountRef.current = 0;
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      const groupsError = createGroupsError('SERVER', errorMessage);
      setError(groupsError);

      // Retry logic with exponential backoff
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        const delay = Math.pow(2, retryCountRef.current) * 1000;
        setTimeout(() => loadGroups(), delay);
      }

      console.error("Failed to load groups:", err);
    } finally {
      setIsLoading(false);
    }
  }, [queryClient]);

  // Get current state from queryClient
  const snapshot = queryClient.getQueryData<GroupsSnapshot>(queryKeys.group.list()) ?? {
    groups: [],
    currentUser: null,
  };

  return {
    groups: snapshot.groups,
    currentUser: snapshot.currentUser,
    isLoading,
    error,
    refetch: loadGroups,
  };
}

/**
 * Hook: Persist groups to API
 * 
 * Responsibilities:
 * - Save groups to API
 * - Update cache
 * - Handle errors with rollback
 */
export function usePersistGroups() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<GroupsError | null>(null);

  const save = useCallback(
    async (nextGroups: GroupRecord[]): Promise<GroupRecord[]> => {
      setError(null);
      
      // Store current state for rollback
      const previousSnapshot = queryClient.getQueryData<GroupsSnapshot>(
        queryKeys.group.list()
      );

      try {
        // Optimistic update
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
        const savedGroups: GroupRecord[] = Array.isArray(payload.value) 
          ? payload.value 
          : nextGroups;

        // Update with server response
        queryClient.setQueryData(queryKeys.group.list(), (current: GroupsSnapshot | undefined) => {
          if (!current) return current;
          return { ...current, groups: savedGroups };
        });

        return savedGroups;
      } catch (err) {
        // Rollback on error
        if (previousSnapshot) {
          queryClient.setQueryData(queryKeys.group.list(), previousSnapshot);
        }

        const groupsError = err instanceof Error 
          ? createGroupsError('SERVER', err.message)
          : createGroupsError('SERVER', 'Failed to save groups');
        
        setError(groupsError);
        throw groupsError;
      }
    },
    [queryClient]
  );

  return { save, error };
}

/**
 * Hook: Handle group membership (join/leave)
 * 
 * Responsibilities:
 * - Toggle join/leave state
 * - Call API
 * - Update cache with optimistic updates
 * - Handle errors with rollback
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
        throw error;
      }

      const { currentUser, groups } = snapshot;

      if (!currentUser) {
        const error = createGroupsError('AUTH', 'User must be signed in');
        onError?.(error);
        throw error;
      }

      const group = groups.find((g) => g.id === groupId);
      if (!group) {
        const error = createGroupsError('VALIDATION', 'Group not found');
        onError?.(error);
        throw error;
      }

      const isJoined = group.joined ?? false;
      const previousSnapshot = snapshot;

      try {
        // Optimistic update
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

        queryClient.setQueryData(queryKeys.group.list(), {
          ...snapshot,
          groups: nextGroups,
        });

        // API call
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
        // Rollback optimistic update
        queryClient.setQueryData(queryKeys.group.list(), previousSnapshot);

        const groupsError = err instanceof Error && 'type' in err
          ? (err as GroupsError)
          : createGroupsError('SERVER', 'Failed to update membership');

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

/**
 * Hook: Handle group creation
 * 
 * Responsibilities:
 * - Create new group with user as creator
 * - Add to groups list
 * - Persist to API
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
        throw error;
      }

      const trimmedName = name.trim();
      const trimmedDesc = description.trim();

      if (!trimmedName || !trimmedDesc) {
        const error = createGroupsError('VALIDATION', 'Name and description are required');
        onError?.(error);
        throw error;
      }

      try {
        const response = await fetch("/api/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            name: trimmedName, 
            description: trimmedDesc 
          }),
        });

        if (!response.ok) {
          throw createGroupsError(
            response.status === 401 ? 'AUTH' : 'SERVER',
            "Failed to create group"
          );
        }

        const result = await response.json();
        const createdGroup = result.value as GroupRecord;

        // Update cache with new group
        queryClient.setQueryData(queryKeys.group.list(), (current: GroupsSnapshot | undefined) => {
          if (!current) return current;
          return {
            ...current,
            groups: [createdGroup, ...current.groups],
          };
        });

        onSuccess?.(createdGroup);
        return createdGroup;
      } catch (err) {
        const groupsError = err instanceof Error && 'type' in err
          ? (err as GroupsError)
          : createGroupsError('SERVER', 'Failed to create group');

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