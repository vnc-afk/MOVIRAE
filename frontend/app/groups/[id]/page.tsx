"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import type { UserProfile } from "@/lib/types";
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
import { useGroupMembership } from "../hooks";
import {
  GroupDetailHeader,
  DiscussionsList,
  EventsList,
  WatchlistTab,
  MembersTab,
} from "./components";
import { GroupDetailLoading } from "./loading";

/**
 * Renders the group detail experience with discussion, watchlist, member, and event tabs.
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

    const { toggleJoin, isToggling } = useGroupMembership(
    (err) => toast.error(err.message),
    (action) => {
      toast.success(action === "joined" ? `Welcome to ${group?.name}!` : `Left ${group?.name}`);
    }
  );
  
  // Load group detail data
  const { group, currentUser, loadState, load, setGroup } = useGroupDetail(id);

  // Load discussions
  const {
    discussions: sortedDiscussions,
    sortType,
    setSortType,
    addDiscussion,
    likeDiscussion,
    addReply,
    setDiscussions,
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

  // Track joined state and keep member follow status shared across the page.
  const [isJoined, setIsJoined] = useState(false);
  const [members, setMembers] = useState<UserProfile[]>([]);


  // Load the group payload once the page mounts so the detail view is populated immediately.
  useEffect(() => {
    if (loadState === "loading") {
      load();
    }
  }, [load, loadState]);

  // Seed discussions from the group detail payload so the tab renders immediately.
  useEffect(() => {
    if (loadState === "ready" && group) {
      setDiscussions(group.discussions ?? []);
    }
  }, [loadState, group, setDiscussions]);

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

  // Update joined state and member follow state when group changes
  useEffect(() => {
    if (group) {
      setIsJoined(group.joined || false);
      setMembers(group.members || []);
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

  // Apply the membership change to the detail view after the mutation succeeds.
  const handleJoinLeave = useCallback(async () => {
    if (!currentUser) {
      toast.error("Sign in to join a group.");
      return;
    }
    if (!group) return;

    try {
      await toggleJoin(group.id);
      const nextIsJoined = !isJoined;
      const nextMembers = nextIsJoined
        ? [currentUser, ...members.filter((member) => member.id !== currentUser.id)]
        : members.filter((member) => member.id !== currentUser.id);

      setIsJoined(nextIsJoined);
      setMembers(nextMembers);
      setGroup((currentGroup) =>
        currentGroup
          ? {
              ...currentGroup,
              joined: nextIsJoined,
              members: nextMembers,
              memberCount: nextMembers.length,
            }
          : currentGroup
      );
    } catch {
      // error toast already shown via the onError callback above
    }
  }, [group, currentUser, isJoined, members, setGroup, toggleJoin]);


  // Sync follow-state updates from the members list to the rest of the page.
  const handleFollowingChange = useCallback((memberId: string, isFollowing: boolean) => {
    setMembers((currentMembers) =>
      currentMembers.map((member) =>
        member.id === memberId ? { ...member, isFollowing } : member
      )
    );
  }, []);

  // Check if user is admin (is the group creator)
  const isAdmin = currentUser && group ? currentUser.id === group.creatorId : false;

  // Render loading state
  if (loadState === "loading") {
    return <GroupDetailLoading />;
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
              members={members}
              creatorId={group.creatorId}
              currentUserId={currentUser?.id}
              onFollowingChange={handleFollowingChange}
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
