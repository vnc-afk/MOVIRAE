"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { fetchJsonValue, makeOptimisticTempId,  parseApiResponse, ApiRequestError } from "../../lib/groupUtils";
import type { GroupDetailRecord, Discussion, DiscussionReply, GroupEventRecord, LoadState } from "../../lib/types";
import type { UserProfile } from "@/lib/types";

export function useGroupDetail(groupId: string) {
  const queryClient = useQueryClient();
  const [group, setGroup] = useState<GroupDetailRecord | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const response = await fetchJsonValue<any>(`/api/groups/${groupId}`);
      if (!isMountedRef.current) return;

      if (!response || !response.value) {
        setLoadState("not-found");
        return;
      }

      const groupData = response.value as GroupDetailRecord;
      const user = response.currentUser ?? null;

      setGroup(groupData);
      setCurrentUser(user);
      setLoadState("ready");

      queryClient.setQueryData(queryKeys.group.detail(groupId), { value: groupData, currentUser: user });
    } catch (err) {
      console.error("Failed to load group detail:", err);
      if (isMountedRef.current) setLoadState("error");
    }
  }, [groupId, queryClient]);

  return { group, currentUser, loadState, load, setGroup };
}

export function useGroupDiscussions(groupId: string, currentUser: UserProfile | null) {
  const queryClient = useQueryClient();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [sortType, setSortType] = useState<"latest" | "popular" | "oldest">("latest");
  const discussionsRef = useRef<Discussion[]>(discussions);
  const isMountedRef = useRef(true);

  useEffect(() => {
    discussionsRef.current = discussions;
  }, [discussions]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
      if (!isMountedRef.current) return;
      const items: Discussion[] = Array.isArray(response?.value) ? response.value : [];
      setDiscussions(items);
      queryClient.setQueryData(queryKeys.group.discussions(groupId), items);
    } catch (err) {
      console.error("Failed to load discussions:", err);
    }
  }, [groupId, queryClient]);

const addDiscussion = useCallback(
  async (title: string, body: string, movieId?: string): Promise<void> => {
    if (!currentUser) throw new Error("User must be signed in");

    const tempId = makeOptimisticTempId("disc");
    const newDiscussion: Discussion = {
      id: tempId, tempId, author: currentUser, title, body,
      date: new Date().toISOString(), likes: 0, replies: 0, likedByMe: false,
      replyItems: [], movieId, opId: `add-${tempId}`,
    };

    setDiscussions((prev) => [newDiscussion, ...prev]);

    try {
      const response = await fetch(`/api/groups/${groupId}/discussions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, movieId }),
      });
      const saved = await parseApiResponse<Discussion>(response);

      setDiscussions((prev) => prev.map((d) => (d.tempId === tempId ? { ...saved, opId: undefined } : d)));
    } catch (err) {
      setDiscussions((prev) => prev.filter((d) => d.tempId !== tempId));
      throw err;
    }
  },
  [groupId, currentUser]
);

const likeDiscussion = useCallback(
  async (discussionId: string): Promise<void> => {
    const previousDiscussions = discussionsRef.current;

    setDiscussions((prev) =>
      prev.map((discussion) => {
        if (discussion.id !== discussionId) return discussion;
        const nextLikedByMe = !discussion.likedByMe;
        const nextLikes = nextLikedByMe ? discussion.likes + 1 : Math.max(discussion.likes - 1, 0);
        return { ...discussion, likes: nextLikes, likedByMe: nextLikedByMe };
      })
    );

    try {
      const response = await fetch(`/api/groups/${groupId}/discussions/${discussionId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const groupData = await parseApiResponse<any>(response);
      const updatedDiscussion = groupData?.discussions?.find(
        (discussion: Discussion) => discussion.id === discussionId
      );

      if (updatedDiscussion) {
        setDiscussions((prev) =>
          prev.map((discussion) => (discussion.id === discussionId ? updatedDiscussion : discussion))
        );
      }
    } catch (err) {
      setDiscussions(previousDiscussions);
      throw err;
    }
  },
  [groupId]
);

const addReply = useCallback(
  async (discussionId: string, body: string): Promise<void> => {
    if (!currentUser) throw new Error("User must be signed in");

    const tempId = makeOptimisticTempId("reply");
    const newReply: DiscussionReply = {
      id: tempId, tempId, author: currentUser, body,
      date: new Date().toISOString(), opId: `reply-${tempId}`,
    };

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

      const saved = await parseApiResponse<Discussion>(response);

      setDiscussions((prev) =>
        prev.map((d) =>
          d.id === discussionId ? { ...saved, opId: undefined } : d
        )
      );
    } catch (err) {
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

export function useGroupEvents(groupId: string, currentUser: UserProfile | null) {
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<GroupEventRecord[]>([]);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const response = await fetchJsonValue<any>(`/api/groups/${groupId}/events?upcoming=false`);
      if (!isMountedRef.current) return;
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
      id: tempId, tempId, title, description: description ?? null, startDate, startTime,
      creator: {
        id: currentUser.id,
        displayName: currentUser.displayName ?? null,
        username: currentUser.username ?? null,
        avatar: currentUser.avatar ?? null,
      },
      attendees: [{ user: currentUser, rsvpStatus: "yes" }],
      opId: `evt-${tempId}`,
    };

    setEvents((prev) => [...prev, newEvent]);

    try {
      const response = await fetch(`/api/groups/${groupId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, startDate, startTime, description }),
      });

      const saved = await parseApiResponse<GroupEventRecord>(response);

      setEvents((prev) => prev.map((e) => (e.tempId === tempId ? { ...saved, opId: undefined } : e)));
    } catch (err) {
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

      const updated = await parseApiResponse<GroupEventRecord>(response);
      setEvents((prev) => prev.map((e) => (e.id === eventId ? updated : e)));
    } catch (err) {
      console.error("Failed to RSVP:", err);
      throw err;
    }
  },
  [groupId]
);

  return { events, loadEvents, addEvent, rsvpEvent, setEvents };
}

export function useRealTimeUpdates(
  groupId: string,
  callbacks?: {
    onDiscussionAdded?: (discussion: Discussion) => void;
    onEventAdded?: (event: GroupEventRecord) => void;
    onDiscussionRemoved?: (discussionId: string) => void;
  }
) {
  const callbacksRef = useRef(callbacks);
  const [reconnectKey, setReconnectKey] = useState(0);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    const eventSource = new EventSource(`/api/groups/${groupId}/updates`);
    let fallbackReconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    eventSource.addEventListener("group-updated", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
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
      if (eventSource.readyState === EventSource.CLOSED) {
        fallbackReconnectTimeout = setTimeout(() => setReconnectKey((k) => k + 1), 3000);
      }
    });

    return () => {
      if (fallbackReconnectTimeout) clearTimeout(fallbackReconnectTimeout);
      eventSource.close();
    };
  }, [groupId, reconnectKey]);
}

export function useGroupWatchlist(groupId: string, currentUser: UserProfile | null) {
  const [movies, setMovies] = useState<any[]>([]);
  const moviesRef = useRef(movies);
  const isMountedRef = useRef(true);

  useEffect(() => {
    moviesRef.current = movies;
  }, [movies]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadWatchlist = useCallback(async () => {
    try {
      const response = await fetchJsonValue<any>(`/api/groups/${groupId}/movies`);
      if (!isMountedRef.current) return;
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
      const response = await fetch(`/api/groups/${groupId}/movies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: movieId }),
      });

      await parseApiResponse(response);
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
    const previousMovies = moviesRef.current;
    setMovies((prev) => prev.filter((m) => m.id !== movieId));

    try {
      const response = await fetch(`/api/groups/${groupId}/movies/${movieId}`, { method: "DELETE" });
      await parseApiResponse(response);
    } catch (err) {
      setMovies(previousMovies);
      console.error("Failed to remove movie:", err);
      throw err;
    }
  },
  [groupId]
);

  return { movies, loadWatchlist, addMovie, removeMovie };
}