"use client";

import { useCallback, useEffect, useRef } from "react";
import { useGroupsList, useGroupMembership, useCreateGroup, type GroupsError } from "./hooks";
import {
  GroupsContainer,
  GroupsHeader,
  CreateGroupDialog,
  GroupsGrid,
  EmptyState,
  ErrorState,
} from "./components";
import { toast } from "sonner";

/**
 * Groups List Page - Orchestrator Component
 *
 * Composition:
 * - Hooks: useGroupsList, useGroupMembership, useCreateGroup
 * - Components: GroupsHeader, CreateGroupDialog, GroupsGrid, EmptyState, ErrorState
 *
 * Responsibilities:
 * - Orchestrate data loading with error handling
 * - Coordinate user interactions with feedback
 * - Manage optimistic updates with rollback
 *
 * Error Handling:
 * - Network errors: Retry with exponential backoff
 * - Validation errors: Show toast with clear message
 * - Auth errors: Prompt to sign in
 * - Server errors: Show error state with retry option
 */
export default function GroupsPage() {
  const toastIdRef = useRef<string | number | null>(null);

  // Load groups with error handling
  const { groups, currentUser, isLoading, error, refetch } = useGroupsList();

  // Handle membership changes with callbacks
  const { toggleJoin, isToggling } = useGroupMembership(
    (error) => handleMembershipError(error),
    (action) => {
      toast.dismiss(toastIdRef.current ?? undefined);
      toast.success(`Group ${action === 'joined' ? 'joined' : 'left'}!`);
    }
  );

  // Handle group creation with callbacks
  const { create: createGroup, isCreating } = useCreateGroup(
    (error) => handleCreationError(error),
    (group) => {
      toast.dismiss(toastIdRef.current ?? undefined);
      toast.success(`Group "${group.name}" created!`);
    }
  );

  // Load groups on mount
  useEffect(() => {
    if (isLoading) {
      refetch();
    }
  }, [isLoading, refetch]);

  // Handle membership errors with user feedback
  const handleMembershipError = useCallback((error: GroupsError) => {
    toast.dismiss(toastIdRef.current ?? undefined);

    switch (error.type) {
      case 'AUTH':
        toast.error('Please sign in to join groups');
        break;
      case 'NETWORK':
        toast.error('Connection error. Please check your internet and try again.');
        break;
      case 'VALIDATION':
        toast.error(error.message);
        break;
      case 'SERVER':
        toast.error('Failed to update membership. Please try again.');
        break;
      default:
        toast.error('An unexpected error occurred');
    }
  }, []);

  // Handle creation errors with user feedback
  const handleCreationError = useCallback((error: GroupsError) => {
    toast.dismiss(toastIdRef.current ?? undefined);

    switch (error.type) {
      case 'AUTH':
        toast.error('Please sign in to create groups');
        break;
      case 'NETWORK':
        toast.error('Connection error. Please check your internet and try again.');
        break;
      case 'VALIDATION':
        toast.error(error.message);
        break;
      case 'SERVER':
        toast.error('Failed to create group. Please try again.');
        break;
      default:
        toast.error('An unexpected error occurred');
    }
  }, []);

  // Handle group creation dialog submission
  const handleCreateGroup = useCallback(
    async (name: string, description: string) => {
      toastIdRef.current = toast.loading('Creating group...');
      try {
        await createGroup(name, description);
      } catch (err) {
        // Error already handled by callback
      }
    },
    [createGroup]
  );

  // Handle join/leave button click
  const handleToggleJoin = useCallback(
    async (groupId: string) => {
      toastIdRef.current = toast.loading('Updating membership...');
      try {
        await toggleJoin(groupId);
      } catch (err) {
        // Error already handled by callback
      }
    },
    [toggleJoin]
  );

  // Handle retry
  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  // Render error state
  if (error) {
    return (
      <GroupsContainer>
        <GroupsHeader>
          <h1 className="text-3xl font-bold">Groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Discover and join communities to watch and discuss movies together
          </p>
        </GroupsHeader>
        <ErrorState 
          error={error} 
          onRetry={handleRetry}
          isRetrying={isLoading}
        />
      </GroupsContainer>
    );
  }

  return (
    <GroupsContainer>
      <GroupsHeader>
        <h1 className="text-3xl font-bold">Groups</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Discover and join communities to watch and discuss movies together
        </p>
      </GroupsHeader>

      <CreateGroupDialog 
        onCreate={handleCreateGroup} 
        isLoading={isCreating}
        disabled={isLoading}
      />

      {isLoading ? (
        <GroupsLoadingSkeleton count={Math.max(3, groups.length)} />
      ) : groups.length === 0 ? (
        <EmptyState />
      ) : (
        <GroupsGrid
          groups={groups}
          onJoinLeave={handleToggleJoin}
          isToggling={isToggling}
          currentUserId={currentUser?.id}
        />
      )}
    </GroupsContainer>
  );
}

/**
 * Loading skeleton component
 * Shows dynamic number of skeletons based on expected group count
 */
function GroupsLoadingSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-64 animate-pulse rounded-lg bg-muted"
          role="status"
          aria-label={`Loading group ${i + 1}`}
        />
      ))}
    </div>
  );
}