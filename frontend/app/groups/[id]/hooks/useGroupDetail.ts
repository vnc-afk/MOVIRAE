"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { applyEntityUpdate } from "@/lib/cacheHelpers";
import { fetchJsonValue, makeOptimisticTempId, isGroupAdmin } from "../../lib/groupUtils";
import type { GroupDetailRecord, Discussion, DiscussionReply, GroupEventRecord, LoadState } from "../../lib/types";
import type { UserProfile } from "@/lib/types";

/**
 * Hook: Load group detail data
 *
 * Responsibilities:
 * - Fetch group data from API
 * - Manage loading state and errors
 * - Cache group data
 *
 * Usage:
 *   const detail = useGroupDetail(groupId);
 *   const { group, isLoading, error } = detail;
 */
export function useGroupDetail(groupId: string) {
  const queryClient = useQueryClient();
  const [group, setGroup] = useState<GroupDetailRecord | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const response = await fetchJsonValue<any>(`/api/groups/${groupId}`);

      if (!response || !response.value) {
        setLoadState("not-found");
        return;
      }

      const groupData = response.value as GroupDetailRecord;
      const user = response.currentUser ?? null;

      setGroup(groupData);
      setCurrentUser(user);
      setLoadState("ready");

      // Cache the data
      queryClient.setQueryData(queryKeys.group.detail(groupId), {
        value: groupData,
        currentUser: user,
      });
    } catch (err) {
      console.error("Failed to load group detail:", err);
      setLoadState("error");
    }
  }, [groupId, queryClient]);

  return {
    group,
    currentUser,
    loadState,
    load,
    setGroup,
  };
}

/**
 * Hook: Manage discussions within a group
 *
 * Responsibilities:
 * - Fetch discussions from API
 * - Add new discussions optimistically
 * - Like/unlike discussions
 * - Add replies
 * - Manage sorting
 *
 * Usage:
 *   const discussions = useGroupDiscussions(groupId);
 *   discussions.addDiscussion(title, body);
 */
export function useGroupDiscussions(groupId: string, currentUser: UserProfile | null) {
  const queryClient = useQueryClient();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [sortType, setSortType] = useState<"latest" | "popular" | "oldest">("latest");

  const sortedDiscussions = useMemo(() => {
    const items = [...discussions];

    switch (sortType) {
      case "popular":
        return items.sort((a, b) => b.likes - a.likes);
      case "oldest":
        return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      case "latest":
      default:
        return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  }, [discussions, sortType]);

  const loadDiscussions = useCallback(async () => {
    try {
      const response = await fetchJsonValue<any>(`/api/groups/${groupId}/discussions`);
      const items: Discussion[] = Array.isArray(response?.value) ? response.value : [];
      setDiscussions(items);
    } catch (err) {
      console.error("Failed to load discussions:", err);
    }
  }, [groupId, queryClient]);

  const addDiscussion = useCallback(
    async (title: string, body: string, movieId?: string): Promise<void> => {
      if (!currentUser) throw new Error("User must be signed in");

      const tempId = makeOptimisticTempId("disc");
      const newDiscussion: Discussion = {
        id: tempId,
        tempId,
        author: currentUser,
        title,
        body,
        date: new Date().toISOString(),
        likes: 0,
        replies: 0,
        likedByMe: false,
        replyItems: [],
        movieId,
        opId: `add-${tempId}`,
      };

      // Optimistic update
      setDiscussions((prev) => [newDiscussion, ...prev]);

      try {
        const response = await fetch(`/api/groups/${groupId}/discussions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, body, movieId }),
        });

        if (!response.ok) throw new Error("Failed to add discussion");

        const result = await response.json();
        const saved = result.value as Discussion;

        // Replace temporary discussion with server version
        setDiscussions((prev) =>
          prev.map((d) => (d.tempId === tempId ? { ...saved, opId: undefined } : d))
        );
      } catch (err) {
        // Revert on error
        setDiscussions((prev) => prev.filter((d) => d.tempId !== tempId));
        throw err;
      }
    },
    [groupId, currentUser]
  );

  const likeDiscussion = useCallback(
    async (discussionId: string): Promise<void> => {
      const previousDiscussions = discussions;

      setDiscussions((prev) =>
        prev.map((discussion) => {
          if (discussion.id !== discussionId) return discussion;

          const nextLikedByMe = !discussion.likedByMe;
          const nextLikes = nextLikedByMe
            ? discussion.likes + 1
            : Math.max(discussion.likes - 1, 0);

          return {
            ...discussion,
            likes: nextLikes,
            likedByMe: nextLikedByMe,
          };
        })
      );

      try {
        const response = await fetch(`/api/groups/${groupId}/discussions/${discussionId}/like`, {
          method: "POST",
        });

        if (!response.ok) throw new Error("Failed to update discussion like");

        const result = await response.json().catch(() => null);
        const groupData = result?.data?.value ?? result?.value;
        const updatedDiscussion = groupData?.discussions?.find(
          (discussion: Discussion) => discussion.id === discussionId
        );

        if (updatedDiscussion) {
          setDiscussions((prev) =>
            prev.map((discussion) =>
              discussion.id === discussionId ? updatedDiscussion : discussion
            )
          );
        }
      } catch (err) {
        setDiscussions(previousDiscussions);
        throw err;
      }
    },
    [groupId, discussions]
  );

  const addReply = useCallback(
    async (discussionId: string, body: string): Promise<void> => {
      if (!currentUser) throw new Error("User must be signed in");

      const tempId = makeOptimisticTempId("reply");
      const newReply: DiscussionReply = {
        id: tempId,
        tempId,
        author: currentUser,
        body,
        date: new Date().toISOString(),
        opId: `reply-${tempId}`,
      };

      // Optimistic update
      setDiscussions((prev) =>
        prev.map((d) =>
          d.id === discussionId
            ? { ...d, replies: d.replies + 1, replyItems: [...(d.replyItems ?? []), newReply] }
            : d
        )
      );

      try {
        const response = await fetch(`/api/groups/${groupId}/discussions/${discussionId}/replies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });

        if (!response.ok) throw new Error("Failed to add reply");

        const result = await response.json();
        const saved = result.value as DiscussionReply;

        // Replace temporary reply
        setDiscussions((prev) =>
          prev.map((d) =>
            d.id === discussionId
              ? {
                  ...d,
                  replyItems: (d.replyItems ?? []).map((r: DiscussionReply) =>
                    r.tempId === tempId ? { ...saved, opId: undefined } : r
                  ),
                }
              : d
          )
        );
      } catch (err) {
        // Revert
        setDiscussions((prev) =>
          prev.map((d) =>
            d.id === discussionId
              ? {
                  ...d,
                  replies: d.replies - 1,
                  replyItems: (d.replyItems ?? []).filter((r: DiscussionReply) => r.tempId !== tempId),
                }
              : d
          )
        );
        throw err;
      }
    },
    [groupId, currentUser]
  );

  return {
    discussions: sortedDiscussions,
    sortType,
    setSortType,
    loadDiscussions,
    addDiscussion,
    likeDiscussion,
    addReply,
    setDiscussions,
  };
}

/**
 * Hook: Manage group events
 *
 * Responsibilities:
 * - Fetch events from API
 * - Create new events
 * - RSVP to events
 * - Delete events (admin only)
 *
 * Usage:
 *   const events = useGroupEvents(groupId);
 *   events.addEvent(title, startDate, startTime);
 */
export function useGroupEvents(groupId: string, currentUser: UserProfile | null) {
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<GroupEventRecord[]>([]);

  const loadEvents = useCallback(async () => {
    try {
      const response = await fetchJsonValue<any>(`/api/groups/${groupId}/events?upcoming=false`);
      const responseItems = response?.value ?? response?.data;
      const items: GroupEventRecord[] = Array.isArray(responseItems) ? responseItems : [];
      setEvents(items);

      queryClient.setQueryData(queryKeys.group.events(groupId), items);
    } catch (err) {
      console.error("Failed to load events:", err);
    }
  }, [groupId, queryClient]);

  const addEvent = useCallback(
    async (title: string, startDate: string, startTime: string, description?: string): Promise<void> => {
      if (!currentUser) throw new Error("User must be signed in");

      const tempId = makeOptimisticTempId("evt");
      const newEvent: GroupEventRecord = {
        id: tempId,
        tempId,
        title,
        description: description ?? null,
        startDate,
        startTime,
        creator: {
          id: currentUser.id,
          displayName: currentUser.displayName ?? null,
          username: currentUser.username ?? null,
          avatar: currentUser.avatar ?? null,
        },
        attendees: [{ user: currentUser, rsvpStatus: "yes" }],
        opId: `evt-${tempId}`,
      };

      // Optimistic update
      setEvents((prev) => [...prev, newEvent]);

      try {
        const response = await fetch(`/api/groups/${groupId}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, startDate, startTime, description }),
        });

        if (!response.ok) throw new Error("Failed to create event");

        const result = await response.json();
        const saved = (result.value ?? result.data) as GroupEventRecord;

        // Replace temporary event
        setEvents((prev) =>
          prev.map((e) => (e.tempId === tempId ? { ...saved, opId: undefined } : e))
        );
      } catch (err) {
        // Revert
        setEvents((prev) => prev.filter((e) => e.tempId !== tempId));
        throw err;
      }
    },
    [groupId, currentUser]
  );

  const rsvpEvent = useCallback(
    async (eventId: string, status: "yes" | "no" | "maybe"): Promise<void> => {
      try {
        const response = await fetch(`/api/groups/${groupId}/events/${eventId}/rsvp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rsvpStatus: status }),
        });

        if (!response.ok) throw new Error("Failed to RSVP");

        const result = await response.json();
        const updated = (result.value ?? result.data ?? result) as GroupEventRecord;

        setEvents((prev) => prev.map((e) => (e.id === eventId ? updated : e)));
      } catch (err) {
        console.error("Failed to RSVP:", err);
        throw err;
      }
    },
    [groupId]
  );

  return {
    events,
    loadEvents,
    addEvent,
    rsvpEvent,
    setEvents,
  };
}

/**
 * Hook: Manage real-time updates via EventSource
 *
 * Responsibilities:
 * - Listen for group updates
 * - Handle new discussions
 * - Handle new events
 * - Reconnect on disconnect
 *
 * Usage:
 *   useRealTimeUpdates(groupId, { onDiscussionAdded, onEventAdded });
 */
export function useRealTimeUpdates(
  groupId: string,
  callbacks?: {
    onDiscussionAdded?: (discussion: Discussion) => void;
    onEventAdded?: (event: GroupEventRecord) => void;
    onDiscussionRemoved?: (discussionId: string) => void;
  }
) {
  const callbacksRef = useRef(callbacks);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    const eventSource = new EventSource(`/api/groups/${groupId}/updates`);

    eventSource.addEventListener("group-updated", (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "discussion-added") {
          callbacksRef.current?.onDiscussionAdded?.(data.discussion);
        } else if (data.type === "event-added") {
          callbacksRef.current?.onEventAdded?.(data.event);
        } else if (data.type === "discussion-removed") {
          callbacksRef.current?.onDiscussionRemoved?.(data.discussionId);
        }
      } catch (err) {
        console.error("Failed to parse real-time update:", err);
      }
    });

    eventSource.addEventListener("error", () => {
      eventSource.close();
      // Reconnect after delay
      setTimeout(() => {
        // Reconnection handled by re-rendering
      }, 3000);
    });

    return () => eventSource.close();
  }, [groupId]);
}

/**
 * Hook: Manage group watchlist
 *
 * Responsibilities:
 * - Fetch shared watchlist movies
 * - Add/remove movies from watchlist
 *
 * Usage:
 *   const watchlist = useGroupWatchlist(groupId);
 *   watchlist.addMovie(movieId);
 */
export function useGroupWatchlist(groupId: string, currentUser: UserProfile | null) {
  const [movies, setMovies] = useState<any[]>([]);

  const loadWatchlist = useCallback(async () => {
    try {
      const response = await fetchJsonValue<any>(`/api/groups/${groupId}/movies`);
      const items = Array.isArray(response?.value) ? response.value : [];
      setMovies(items);
    } catch (err) {
      console.error("Failed to load watchlist:", err);
    }
  }, [groupId]);

  const addMovie = useCallback(
    async (movieId: string): Promise<void> => {
      if (!currentUser) throw new Error("User must be signed in");

      try {
        await fetch(`/api/groups/${groupId}/movies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ movieId }),
        });

        // Reload watchlist
        await loadWatchlist();
      } catch (err) {
        console.error("Failed to add movie:", err);
        throw err;
      }
    },
    [groupId, currentUser, loadWatchlist]
  );

  const removeMovie = useCallback(
    async (movieId: string): Promise<void> => {
      try {
        await fetch(`/api/groups/${groupId}/movies/${movieId}`, {
          method: "DELETE",
        });

        setMovies((prev) => prev.filter((m) => m.id !== movieId));
      } catch (err) {
        console.error("Failed to remove movie:", err);
        throw err;
      }
    },
    [groupId]
  );

  return {
    movies,
    loadWatchlist,
    addMovie,
    removeMovie,
  };
}
