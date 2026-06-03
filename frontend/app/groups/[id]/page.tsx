"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import {
  useGroupDetail,
  useGroupDiscussions,
  useGroupEvents,
  useRealTimeUpdates,
  useGroupWatchlist,
} from "./hooks";
import {
  GroupDetailHeader,
  DiscussionsList,
  EventsList,
  WatchlistTab,
  MembersTab,
} from "./components";
import { isGroupAdmin } from "../lib/groupUtils";
import type { LoadState } from "../lib/types";

/**
 * Group Detail Page - Orchestrator Component
 *
 * Composition:
 * - Hooks: useGroupDetail, useGroupDiscussions, useGroupEvents, useGroupWatchlist, useRealTimeUpdates
 * - Components: GroupDetailHeader, DiscussionsList, EventsList, WatchlistTab, MembersTab
 * - Tabs: discussions, watchlist, members, events
 *
 * Responsibilities:
 * - Orchestrate all data loading
 * - Coordinate user interactions across tabs
 * - Manage tab navigation with URL sync
 * - Handle real-time updates via EventSource
 *
 * Performance:
 * - Minimal re-renders via isolated hooks
 * - Optimistic updates for all operations
 * - EventSource for real-time collaboration
 * - Cached API responses via queryClient
 */
export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const searchParams = useSearchParams();

  // Determine active tab from URL
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    return tab === "watchlist" || tab === "members" || tab === "events"
      ? tab
      : "discussions";
  });

  // Load group detail data
  const { group, currentUser, loadState, load, setGroup } = useGroupDetail(id);

  // Load discussions
  const {
    discussions: sortedDiscussions,
    sortType,
    setSortType,
    loadDiscussions,
    addDiscussion,
    likeDiscussion,
    addReply,
  } = useGroupDiscussions(id, currentUser);

  // Load events
  const { events, loadEvents, addEvent, rsvpEvent, setEvents } = useGroupEvents(
    id,
    currentUser
  );

  // Load watchlist
  const { movies, loadWatchlist, addMovie, removeMovie } = useGroupWatchlist(
    id,
    currentUser
  );

  // Setup real-time updates
  useRealTimeUpdates(id, {
    onDiscussionAdded: (discussion) => {
      // Discussion will be updated via EventSource, just ensure UI is fresh
    },
    onEventAdded: (event) => {
      // Event will be updated via EventSource
    },
  });

  // Track joined state
  const [isJoined, setIsJoined] = useState(false);

  // Initialize data load on mount
  useEffect(() => {
    load();
  }, [load]);

  // Load discussions when group is ready
  useEffect(() => {
    if (loadState === "ready" && group) {
      loadDiscussions();
    }
  }, [loadState, group, loadDiscussions]);

  // Load events when group is ready
  useEffect(() => {
    if (loadState === "ready" && group) {
      loadEvents();
    }
  }, [loadState, group, loadEvents]);

  // Load watchlist when group is ready
  useEffect(() => {
    if (loadState === "ready" && group) {
      loadWatchlist();
    }
  }, [loadState, group, loadWatchlist]);

  // Update joined state when group changes
  useEffect(() => {
    if (group) {
      setIsJoined(group.joined || false);
    }
  }, [group]);

  // Update active tab from URL
  useEffect(() => {
    const tab = searchParams.get("tab");
    setActiveTab(
      tab === "watchlist" || tab === "members" || tab === "events"
        ? tab
        : "discussions"
    );
  }, [searchParams]);

  // Sync tab changes to URL
  const handleTabChange = useCallback(
    (tab: string) => {
      setActiveTab(tab);
      if (tab === "discussions") {
        router.push(`/groups/${id}`);
      } else {
        router.push(`/groups/${id}?tab=${encodeURIComponent(tab)}`);
      }
    },
    [id, router]
  );

  // Handle join/leave
  const handleJoinLeave = useCallback(async () => {
    if (!currentUser) {
      toast.error("Sign in to join a group.");
      return;
    }

    if (!group) return;

    const nextJoined = !isJoined;
    setIsJoined(nextJoined);

    try {
      // TODO: Call API to persist join/leave
      toast.success(
        nextJoined
          ? `Welcome to ${group.name}!`
          : `Left ${group.name}`
      );
    } catch (err) {
      setIsJoined(!nextJoined);
      toast.error("Failed to update membership");
    }
  }, [group, currentUser, isJoined]);

  // Check if user is admin
  const isAdmin = currentUser && group ? isGroupAdmin(currentUser, group) : false;

  // Render loading state
  if (loadState === "loading") {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground">Loading group...</p>
      </div>
    );
  }

  // Render error state
  if (loadState === "error") {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground">
          Could not load this group right now.
        </p>
        <Button className="mt-4" onClick={() => router.refresh()}>
          Try Again
        </Button>
      </div>
    );
  }

  // Render not found state
  if (!group) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground">
          Group not found. Go back to groups.
        </p>
        <Button className="mt-4" onClick={() => router.push("/groups")}>
          Back to Groups
        </Button>
      </div>
    );
  }

  return (
    <div className="pb-20 md:pb-0">
      {/* Header */}
      <GroupDetailHeader
        group={group}
        isJoined={isJoined}
        onJoinLeave={handleJoinLeave}
        currentUser={currentUser}
        discussionCount={sortedDiscussions.length}
      />

      {/* Tabs */}
      <div className="container py-8">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList>
            <TabsTrigger value="discussions">Discussions</TabsTrigger>
            <TabsTrigger value="watchlist">Shared Watchlist</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>

          {/* Discussions Tab */}
          <TabsContent value="discussions" className="space-y-6">
            <DiscussionsList
              discussions={sortedDiscussions}
              sortType={sortType}
              onSortChange={setSortType}
              onAddDiscussion={addDiscussion}
              onLikeDiscussion={likeDiscussion}
              onAddReply={addReply}
              currentUser={currentUser}
              groupId={id}
            />
          </TabsContent>

          {/* Watchlist Tab */}
          <TabsContent value="watchlist" className="space-y-6">
            <WatchlistTab
              movies={movies}
              onAddMovie={addMovie}
              onRemoveMovie={removeMovie}
              canEdit={isJoined}
            />
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-6">
            <MembersTab
              members={group.members || []}
              creatorId={group.creatorId}
              currentUserId={currentUser?.id}
            />
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-6">
            <EventsList
              events={events}
              onAddEvent={addEvent}
              onRsvp={rsvpEvent}
              onDeleteEvent={undefined}
              currentUser={currentUser}
              isAdmin={isAdmin}
              groupId={id}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
