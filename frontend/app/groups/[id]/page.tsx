"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  Users,
  Film,
  MessageCircle,
  ArrowLeft,
  Send,
  Heart,
  Loader2,
  Calendar,
  Sparkles,
  Pin,
  UserPlus,
  UserMinus,
  Plus,
  Search,
  Clock,
  X,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/components/FollowButton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { generateOpId, makeTempId as makeOptimisticTempId, attachOpToBody, attachOpToHeaders, reconcileTempItem } from "@/lib/optimistic";
import { searchMovies } from "@/lib/tmdb";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoviePrefetchLink } from "@/components/MoviePrefetchLink";
import { useOptimisticOps } from "@/hooks/useOptimisticOps";
import type { Group, Movie, UserProfile } from "@/lib/types";
import { queryKeys } from "@/lib/queryKeys";
import { applyEntityUpdate } from "@/lib/cacheHelpers";

interface DiscussionReply {
  id: string;
  author: UserProfile;
  body: string;
  date: string;
}

interface Discussion {
  id: string;
  author: UserProfile;
  title: string;
  body: string;
  date: string;
  likes: number;
  replies: number;
  likedByMe?: boolean;
  replyItems?: DiscussionReply[];
  pinned?: boolean;
  movieId?: string;
}

type GroupRecord = Group & { discussions?: Discussion[]; joined?: boolean };
type LoadState = "loading" | "ready" | "not-found" | "error";
type GroupDetailResponse = { value?: GroupRecord | null; currentUser?: UserProfile | null };
type GroupEventRecord = {
  id: string;
  title: string;
  description?: string | null;
  startDate: string;
  startTime: string;
  location?: string | null;
  creator?: { id: string; displayName?: string | null; username?: string | null; avatar?: string | null } | null;
  attendees?: Array<{ user?: { id: string; displayName?: string | null; username?: string | null; avatar?: string | null } | null; rsvpStatus?: string }>;
  opId?: string;
  tempId?: string;
};

function sortEventsByDate(events: GroupEventRecord[]) {
  return [...events].sort((a, b) => {
    const aDate = new Date(`${a.startDate}T${a.startTime || "00:00"}`).getTime();
    const bDate = new Date(`${b.startDate}T${b.startTime || "00:00"}`).getTime();
    return aDate - bDate;
  });
}

function formatDiscussionDate(date: string) {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return date;

  const distance = formatDistanceToNowStrict(parsedDate, { addSuffix: true });
  return distance === "0 seconds ago" ? "Just now" : distance;
}

export default function GroupDetail() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isInFlight, addInFlightOp, removeInFlightOp, getInFlightByItemId } = useOptimisticOps();
  const queryClient = useQueryClient();
  const [group, setGroup] = useState<GroupRecord | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [joined, setJoined] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [discussionSort, setDiscussionSort] = useState<"latest" | "popular" | "oldest">("latest");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [isAdmin, setIsAdmin] = useState(false);
  const [moviesWithHover, setMoviesWithHover] = useState<Set<string>>(new Set());
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [events, setEvents] = useState<GroupEventRecord[]>([]);
  const [addMovieOpen, setAddMovieOpen] = useState(false);
  const [movieSearch, setMovieSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    return tab === "watchlist" || tab === "members" || tab === "events" ? tab : "discussions";
  });

  const loadGroup = async (showLoadingState = false) => {
    if (showLoadingState) {
      setLoadState((current) => (current === "ready" ? current : "loading"));
    }

    const response = await fetch(`/api/groups/${id}`, { cache: "no-store" });
    if (response.status === 404) {
      setGroup(null);
      setLoadState("not-found");
      return null;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      try {
        const parsed = body ? JSON.parse(body) : null;
        console.error("loadGroup server error:", parsed ?? body ?? response.status);
      } catch (e) {
        console.error("loadGroup server error (non-json):", body || response.status);
      }
      setLoadState("error");
      return null;
    }

    const payload = (await response.json()) as GroupDetailResponse;
    const nextGroup = (payload.value ?? null) as GroupRecord | null;

    setGroup(nextGroup);
    setCurrentUser(payload.currentUser ?? null);
    setJoined(Boolean(nextGroup?.joined));
    setLoadState(nextGroup ? "ready" : "not-found");
    return nextGroup;
  };

  useEffect(() => {
    const tab = searchParams.get("tab");
    const nextTab = tab === "watchlist" || tab === "members" || tab === "events" ? tab : "discussions";
    setActiveTab(nextTab);
  }, [searchParams]);

  const setTabAndUrl = (tab: string) => {
    setActiveTab(tab);
    router.push(tab === "discussions" ? `/groups/${id}` : `/groups/${id}?tab=${encodeURIComponent(tab)}`);
  };

  function makeTempId(prefix = "temp") {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const checkAdminStatus = () => {
    if (!group || !currentUser) {
      setIsAdmin(false);
      return;
    }
    // User is admin if they're the group creator
    // The server will do full admin check (engagement + tenure) on event creation
    setIsAdmin(currentUser.id === group.creatorId);
  };

  useEffect(() => {
    let isActive = true;
    let eventSource: EventSource | null = null;

    setLoadState("loading");

    const loadData = async () => {
      try {
        await loadGroup(true);
        
        // Load events
        const eventsResponse = await fetch(`/api/groups/${id}/events?data=1`, { cache: "no-store" });
        if (eventsResponse.ok && isActive) {
          const eventsPayload = await eventsResponse.json();
          const newEvents = Array.isArray(eventsPayload.value) ? sortEventsByDate(eventsPayload.value as GroupEventRecord[]) : [];
          setEvents(newEvents);
          queryClient.setQueryData(queryKeys.group.events(id), newEvents);
        }
      } catch (error) {
        console.error("Failed to load group detail:", error);
        if (isActive) {
          setLoadState("error");
        }
      }
    };

    loadData();

    eventSource = new EventSource(`/api/groups/${id}/events`);
    eventSource.addEventListener("group-updated", (ev) => {
      if (!isActive) return;

      try {
        const payload = JSON.parse((ev as MessageEvent).data || "{}");
        const incomingOpId = typeof payload?.opId === "string" ? payload.opId : undefined;

        const action = typeof payload?.action === "string" ? payload.action : undefined;
        const serverGroup = payload?.group ?? null;
        const serverEvent = payload?.event ?? null;
        const serverEventId = typeof payload?.eventId === "string" ? payload.eventId : undefined;

            if (serverGroup) {
          if (incomingOpId && group) {
            const tempDiscussion = (group.discussions ?? []).find((discussion) => (discussion as any).opId === incomingOpId || (discussion as any).tempId === incomingOpId) as any;
            if (tempDiscussion) {
              const serverDiscussion = (serverGroup.discussions ?? []).find((discussion: any) => discussion.title === tempDiscussion.title && discussion.body === tempDiscussion.body && discussion.author?.id === tempDiscussion.author?.id && !String(discussion.id).startsWith("temp-"));
                if (serverDiscussion) {
                const op = { opId: incomingOpId, type: "create" as const, tempId: tempDiscussion.tempId, ts: Date.now() };
                setGroup((prev) => {
                  if (!prev) return serverGroup;
                  const nextDiscussions = reconcileTempItem(prev.discussions ?? [], op, serverDiscussion);
                  return { ...serverGroup, discussions: nextDiscussions } as GroupRecord;
                });
                try {
                  applyEntityUpdate(queryClient, [queryKeys.group.detail(id)], () => ({ ...serverGroup, discussions: (serverGroup.discussions ?? []).map((d: any) => ({ ...d })) }));
                } catch (e) {
                  /* best-effort */
                }
              } else {
                setGroup(serverGroup);
                try {
                  applyEntityUpdate(queryClient, [queryKeys.group.detail(id)], () => serverGroup as any);
                } catch (e) {
                  /* best-effort */
                }
              }
            } else {
              for (const discussion of group.discussions ?? []) {
                const tempReply = (discussion.replyItems ?? []).find((reply: any) => (reply as any).opId === incomingOpId || (reply as any).tempId === incomingOpId) as any;
                if (!tempReply) {
                  continue;
                }

                const serverDiscussion = (serverGroup.discussions ?? []).find((item: any) => item.id === discussion.id);
                const serverReply = serverDiscussion?.replyItems?.find((reply: any) => reply.body === tempReply.body && reply.author?.id === tempReply.author?.id && !String(reply.id).startsWith("temp-"));
                if (serverDiscussion && serverReply) {
                  const op = { opId: incomingOpId, type: "create" as const, tempId: tempReply.tempId, ts: Date.now() };
                  setGroup((prev) => {
                    if (!prev) return serverGroup;
                    const nextDiscussions = (prev.discussions ?? []).map((item) => {
                      if (item.id !== serverDiscussion.id) return item;
                      return { ...serverDiscussion, replyItems: reconcileTempItem(item.replyItems ?? [], op, serverReply) } as any;
                    });
                    return { ...serverGroup, discussions: nextDiscussions } as GroupRecord;
                  });
                  try {
                    applyEntityUpdate(queryClient, [queryKeys.group.detail(id)], () => ({ ...serverGroup }));
                  } catch (e) {
                    /* best-effort */
                  }
                  break;
                }

                setGroup(serverGroup);
                try {
                  applyEntityUpdate(queryClient, [queryKeys.group.detail(id)], () => serverGroup as any);
                } catch (e) {
                  /* best-effort */
                }
                break;
              }
            }
          } else {
            setGroup(serverGroup);
            try {
              applyEntityUpdate(queryClient, [queryKeys.group.detail(id)], () => serverGroup as any);
            } catch (e) {
              /* best-effort */
            }
          }
        }

        if (serverEvent) {
          const nextEvent = serverEvent as GroupEventRecord;
          setEvents((prev) => {
            if (action === "deleted") {
              const targetId = typeof nextEvent.id === "string" ? nextEvent.id : serverEventId;
              const next = prev.filter((event) => event.id !== targetId);
              queryClient.setQueryData(queryKeys.group.events(id), next);
              return next;
            }

            const tempMatchId = incomingOpId
              ? prev.find((event) => event.opId === incomingOpId || event.tempId === incomingOpId)?.id
              : undefined;
            const nextEvents = prev.map((event) => {
              if (event.id === nextEvent.id) return nextEvent;
              if (tempMatchId && event.id === tempMatchId) return nextEvent;
              if (incomingOpId && (event.opId === incomingOpId || event.tempId === incomingOpId)) return nextEvent;
              return event;
            });
            if (!nextEvents.some((event) => event.id === nextEvent.id)) {
              nextEvents.unshift(nextEvent);
            }
            const sorted = sortEventsByDate(nextEvents);
            queryClient.setQueryData(queryKeys.group.events(id), sorted);
            return sorted;
          });
          return;
        }

        if (action === "deleted" && serverEventId) {
          setEvents((prev) => {
            const next = prev.filter((event) => event.id !== serverEventId);
            queryClient.setQueryData(queryKeys.group.events(id), next);
            return next;
          });
          return;
        }

        if (!serverGroup) {
          console.warn("Group SSE payload missing canonical data:", payload);
        }
      } catch (err) {
        console.error("Failed to process group SSE payload:", err);
      }
    });
    eventSource.onerror = () => {
      // The browser will retry automatically; keep the current view mounted.
    };

    return () => {
      isActive = false;
      eventSource?.close();
    };
  }, [id]);

  useEffect(() => {
    if (group) {
      setJoined(Boolean(group.joined));
      checkAdminStatus();
    }
  }, [group, currentUser]);

  const handleSearchMovies = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const results = await searchMovies(query);
      setSearchResults(results);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearchMovies(movieSearch);
    }, 500);

    return () => clearTimeout(timer);
  }, [movieSearch, handleSearchMovies]);

  const discussions = group?.discussions ?? [];
  const sortedDiscussions = useMemo(() => {
    const items = [...discussions];

    switch (discussionSort) {
      case "popular":
        return items.sort((a, b) => {
          if (b.likes !== a.likes) return b.likes - a.likes;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
      case "oldest":
        return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      case "latest":
      default:
        return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  }, [discussions, discussionSort]);

  if (loadState === "loading") {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground">Loading group...</p>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground">Could not load this group right now.</p>
        <Button className="mt-4" onClick={() => router.refresh()}>Try Again</Button>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground">Group not found. Go back to groups.</p>
        <Button className="mt-4" onClick={() => router.push("/groups")}>Back to Groups</Button>
      </div>
    );
  }

  const refreshGroupFromResponse = async (response: Response) => {
    const payload = await response.json();
    const nextGroup = (payload.value ?? null) as GroupRecord | null;
    if (nextGroup) {
      setGroup(nextGroup);
      setJoined(Boolean(nextGroup.joined));
    }
    return nextGroup;
  };

  const persistGroup = async (nextGroup: GroupRecord) => {
    const response = await fetch("/api/data/groups", { cache: "no-store" });
    const payload = await response.json();
    const groups = Array.isArray(payload.value) ? payload.value : [];
    const nextGroups = groups.map((item: GroupRecord) => (item.id === nextGroup.id ? nextGroup : item));
    const writeResponse = await fetch("/api/data/groups", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextGroups),
    });
    const writePayload = await writeResponse.json();
    const updatedGroups = Array.isArray(writePayload.value) ? writePayload.value : nextGroups;
    const updatedGroup = updatedGroups.find((item: GroupRecord) => item.id === nextGroup.id) ?? nextGroup;
    setGroup(updatedGroup);
    return updatedGroup;
  };

  const applyMembership = (targetGroup: GroupRecord, shouldJoin: boolean) => {
    if (!currentUser) return targetGroup;

    const alreadyMember = targetGroup.members.some((member) => member.id === currentUser.id);
    const members = shouldJoin
      ? alreadyMember
        ? targetGroup.members
        : [currentUser, ...targetGroup.members]
      : targetGroup.members.filter((member) => member.id !== currentUser.id);

    return {
      ...targetGroup,
      members,
      memberCount: members.length,
      joined: shouldJoin,
    };
  };

  const handleJoin = async () => {
    if (!currentUser) {
      toast.error("Sign in to join a group.");
      return;
    }

    const nextJoined = !joined;
    setJoined(nextJoined);
    await persistGroup(applyMembership(group, nextJoined));
    await loadGroup(false);
    toast.success(nextJoined ? `Welcome to ${group.name}!` : `Left ${group.name}`);
  };

  const handlePost = async () => {
    if (!newTitle.trim() || !newBody.trim() || !currentUser) {
      toast.error("Add a title and a message before posting.");
      return;
    }

    const opId = `group-discussion-${group?.id}`;
    if (isInFlight(opId)) return;

    addInFlightOp(opId, {
      opId,
      type: "post",
      surface: "group",
      itemId: group?.id,
      payload: { title: newTitle, body: newBody },
    });

    const tempId = makeOptimisticTempId("discussion");
    const op = { opId: generateOpId("discussion"), type: "create" as const, tempId, ts: Date.now() };
    const tempDiscussion = {
      id: tempId,
      tempId,
      opId: op.opId,
      author: currentUser,
      title: newTitle,
      body: newBody,
      date: new Date().toISOString(),
      likes: 0,
      replies: 0,
      likedByMe: false,
      replyItems: [] as any[],
    } as any;

    const prevGroup = group;
    try {
      // Optimistically insert at the top
      setGroup((g) => (g ? { ...g, discussions: [tempDiscussion, ...(g.discussions ?? [])] } : g));
      setNewTitle("");
      setNewBody("");

      const body = attachOpToBody({ title: tempDiscussion.title, body: tempDiscussion.body }, op);
      const headers = attachOpToHeaders({ "Content-Type": "application/json" }, op);

      const response = await fetch(`/api/groups/${id}/discussions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        // rollback
        setGroup(prevGroup);
        toast.error("Could not post the discussion.");
        return;
      }

      const payload = await response.json().catch(() => null);
      const serverGroup = payload?.value ?? null;
      const respOpId = payload?.opId;

      if (serverGroup && respOpId) {
        // try to find the server-created discussion matching our temp content
        const serverDiscussion = (serverGroup.discussions ?? []).find((d: any) => d.title === tempDiscussion.title && d.body === tempDiscussion.body && d.author?.id === currentUser.id && !String(d.id).startsWith("temp-"));
        if (serverDiscussion) {
          // replace temp item in current group discussions
          setGroup((prev) => {
            if (!prev) return serverGroup;
            const nextDiscussions = reconcileTempItem(prev.discussions ?? [], op, serverDiscussion);
            return { ...serverGroup, discussions: nextDiscussions } as GroupRecord;
          });
        } else {
          setGroup(serverGroup);
        }
      } else if (serverGroup) {
        setGroup(serverGroup);
      }

      toast.success("Discussion posted!");
    } catch (err) {
      setGroup(prevGroup);
      toast.error("Could not post the discussion.");
    } finally {
      removeInFlightOp(opId);
    }
  };

  const toggleLike = async (discussionId: string) => {
    if (!currentUser) {
      toast.error("Sign in to like a discussion.");
      return;
    }

    const opId = `group-like-${discussionId}`;
    if (isInFlight(opId)) return;

    addInFlightOp(opId, {
      opId,
      type: "like",
      surface: "group",
      itemId: discussionId,
    });

    const prevGroup = group;
    try {
      // Compute original likes from current state to avoid double increments
      const originalLikes = group?.discussions?.find((d) => d.id === discussionId)?.likes ?? 0;
      const currentLiked = Boolean(group?.discussions?.find((d) => d.id === discussionId)?.likedByMe);
      const nextLikedByMe = !currentLiked;
      const optimisticLikes = nextLikedByMe ? originalLikes + 1 : Math.max(originalLikes - 1, 0);

      // Optimistic update
      setGroup((g) => {
        if (!g) return g;
        const next = { ...g, discussions: (g.discussions ?? []).map((d) => {
          if (d.id !== discussionId) return d;
          return { ...d, likedByMe: nextLikedByMe, likes: optimisticLikes } as typeof d;
        }) };
        return next;
      });

      const response = await fetch(`/api/groups/${id}/discussions/${discussionId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        setGroup(prevGroup);
        toast.error("Could not update the like.");
        return;
      }

      await refreshGroupFromResponse(response);
    } catch (err) {
      setGroup(prevGroup);
      toast.error("Could not update the like.");
    } finally {
      removeInFlightOp(opId);
    }
  };

  const handleReply = async (discussionId: string) => {
    if (!currentUser) {
      toast.error("Sign in to reply.");
      return;
    }

    const replyBody = replyDrafts[discussionId]?.trim();
    if (!replyBody) {
      toast.error("Write a reply before posting.");
      return;
    }

    const opId = `group-reply-${discussionId}`;
    if (isInFlight(opId)) return;

    addInFlightOp(opId, {
      opId,
      type: "reply",
      surface: "group",
      itemId: discussionId,
      payload: { body: replyBody },
    });

    const tempReplyId = makeOptimisticTempId("reply");
    const op = { opId: generateOpId("reply"), type: "create" as const, tempId: tempReplyId, ts: Date.now() };
    const tempReply = {
      id: tempReplyId,
      tempId: tempReplyId,
      opId: op.opId,
      author: currentUser,
      body: replyBody,
      date: new Date().toISOString(),
    } as any;

    const prevGroup = group;
    try {
      // Optimistically append reply and increment counter
      setGroup((g) => {
        if (!g) return g;
        const discussions = (g.discussions ?? []).map((d) => {
          if (d.id !== discussionId) return d;
          const nextReplyItems = [...(d.replyItems ?? []), tempReply];
          return { ...d, replyItems: nextReplyItems, replies: (d.replies ?? 0) + 1 } as typeof d;
        });
        return { ...g, discussions };
      });

      setReplyDrafts((prev) => ({ ...prev, [discussionId]: "" }));
      setExpandedReplies((prev) => ({ ...prev, [discussionId]: true }));

      const body = attachOpToBody({ body: replyBody }, op);
      const headers = attachOpToHeaders({ "Content-Type": "application/json" }, op);

      const response = await fetch(`/api/groups/${id}/discussions/${discussionId}/replies`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        setGroup(prevGroup);
        toast.error("Could not post the reply.");
        return;
      }

      const payload = await response.json().catch(() => null);
      const serverGroup = payload?.value ?? null;
      const respOpId = payload?.opId;

      if (serverGroup && respOpId) {
        // find server reply and reconcile
        const serverDiscussion = (serverGroup.discussions ?? []).find((d: any) => d.id === discussionId);
        const serverReply = serverDiscussion?.replyItems?.find((r: any) => r.body === tempReply.body && r.author?.id === currentUser.id && !String(r.id).startsWith("temp-"));
        if (serverReply) {
          setGroup((prev) => {
            if (!prev) return serverGroup;
            const discussions = prev.discussions ?? [];
            const idx = discussions.findIndex((d) => d.id === discussionId);
            if (idx === -1) return serverGroup;
            const nextReplyItems = reconcileTempItem(discussions[idx].replyItems ?? [], op, serverReply);
            const nextDiscussions = discussions.map((d, i) => i === idx ? { ...serverDiscussion, replyItems: nextReplyItems } : d);
            return { ...serverGroup, discussions: nextDiscussions } as GroupRecord;
          });
        } else {
          setGroup(serverGroup);
        }
      } else if (serverGroup) {
        setGroup(serverGroup);
      }

      toast.success("Reply posted!");
    } catch (err) {
      setGroup(prevGroup);
      toast.error("Could not post the reply.");
    } finally {
      removeInFlightOp(opId);
    }
  };

  const handleCreateEvent = async () => {
    if (!eventTitle.trim() || !eventDate.trim() || !eventTime.trim()) {
      toast.error("Please fill in the event title, date, and time.");
      return;
    }

    const opId = generateOpId();
    const tempId = makeOptimisticTempId("event");
    const optimisticEvent: GroupEventRecord = {
      id: tempId,
      tempId,
      opId,
      title: eventTitle.trim(),
      description: eventDescription.trim() || null,
      startDate: eventDate,
      startTime: eventTime,
      location: eventLocation.trim() || null,
      creator: currentUser
        ? {
            id: currentUser.id,
            displayName: currentUser.displayName,
            username: currentUser.username,
            avatar: currentUser.avatar,
          }
        : null,
      attendees: [],
    };

    setActiveTab("events");
    router.push(`/groups/${id}?tab=events`);
    setEvents((prev) => {
      const next = sortEventsByDate([optimisticEvent, ...prev.filter((event) => event.id !== optimisticEvent.id)]);
      queryClient.setQueryData(queryKeys.group.events(id), next);
      return next;
    });

    try {
      const body = attachOpToBody(
        {
          title: eventTitle.trim(),
          description: eventDescription,
          startDate: eventDate,
          startTime: eventTime,
          location: eventLocation,
        },
        { opId, type: "create", tempId, ts: Date.now() }
      );
      const headers = attachOpToHeaders({ "Content-Type": "application/json" }, { opId, type: "create", tempId, ts: Date.now() });

      const response = await fetch(`/api/groups/${id}/events`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        setEvents((prev) => {
          const next = prev.filter((event) => event.id !== tempId);
          queryClient.setQueryData(queryKeys.group.events(id), next);
          return next;
        });
        toast.error(errorPayload?.error || "Could not create event.");
        return;
      }

      const createdEvent = await response.json().catch(() => null);
      if (createdEvent?.id) {
        setEvents((prev) => {
          const nextEvents = prev.map((event) => (event.id === tempId || event.opId === opId ? { ...createdEvent, opId, tempId } : event));
          const next = sortEventsByDate(nextEvents as GroupEventRecord[]);
          queryClient.setQueryData(queryKeys.group.events(id), next);
          return next;
        });
      }

      setEventTitle("");
      setEventDate("");
      setEventTime("");
      setEventLocation("");
      setEventDescription("");
      setCreateEventOpen(false);
      toast.success("Event created!");
    } catch (error) {
      setEvents((prev) => {
        const next = prev.filter((event) => event.id !== tempId);
        queryClient.setQueryData(queryKeys.group.events(id), next);
        return next;
      });
      toast.error("Failed to create event.");
    }
  };

  const handleRemoveMovie = async (movieId: string) => {
    if (!group) return;

    const opId = generateOpId();
    const previousGroup = group;
    const nextSharedList = group.sharedList.filter((movie) => movie.id !== movieId);
    const nextGroup = { ...group, sharedList: nextSharedList };

    setGroup(nextGroup);
    queryClient.setQueryData(queryKeys.group.detail(id), nextGroup);
    applyEntityUpdate(queryClient, [queryKeys.group.list()], (current: { groups: GroupRecord[]; currentUser: UserProfile | null } | undefined) => {
      if (!current) return current;
      return {
        ...current,
        groups: current.groups.map((item) =>
          item.id === id ? { ...item, sharedList: nextSharedList } : item
        ),
      };
    });
    addInFlightOp(opId, {
      opId,
      type: "delete",
      itemId: movieId,
      surface: "group",
      payload: { tmdbId: movieId },
    });

    try {
      const body = attachOpToBody({ tmdbId: movieId }, { opId, type: "delete", tempId: movieId, ts: Date.now() });
      const headers = attachOpToHeaders({ "Content-Type": "application/json" }, { opId, type: "delete", tempId: movieId, ts: Date.now() });

      const response = await fetch(`/api/groups/${id}/movies/${movieId}`, {
        method: "DELETE",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        setGroup(previousGroup);
        queryClient.setQueryData(queryKeys.group.detail(id), previousGroup);
        applyEntityUpdate(queryClient, [queryKeys.group.list()], (current: { groups: GroupRecord[]; currentUser: UserProfile | null } | undefined) => {
          if (!current) return current;
          return {
            ...current,
            groups: current.groups.map((item) =>
              item.id === id ? previousGroup : item
            ),
          };
        });
        const errorPayload = await response.json().catch(() => null);
        toast.error(errorPayload?.error || "Could not remove movie.");
        return;
      }

      toast.success("Movie removed from shared list.");
    } catch (error) {
      setGroup(previousGroup);
      queryClient.setQueryData(queryKeys.group.detail(id), previousGroup);
      applyEntityUpdate(queryClient, [queryKeys.group.list()], (current: { groups: GroupRecord[]; currentUser: UserProfile | null } | undefined) => {
        if (!current) return current;
        return {
          ...current,
          groups: current.groups.map((item) =>
            item.id === id ? previousGroup : item
          ),
        };
      });
      toast.error("Failed to remove movie.");
    } finally {
      removeInFlightOp(opId);
    }
  };

  const handleAddMovie = async (movie: Movie) => {
    const tmdbId = movie.id;
    const opId = generateOpId();
    const previousGroup = group;
    const optimisticMovie: Movie = {
      id: movie.id,
      title: movie.title,
      year: movie.year,
      rating: movie.rating,
      genre: movie.genre,
      poster: movie.poster,
      synopsis: movie.synopsis,
      director: movie.director,
      cast: movie.cast,
      reviews: movie.reviews,
      tags: movie.tags,
      streamingOn: movie.streamingOn,
      runtime: movie.runtime,
      language: movie.language,
      country: movie.country,
      moods: movie.moods,
    };

    const nextSharedList = [optimisticMovie, ...(group?.sharedList ?? []).filter((item) => item.id !== tmdbId)];
    const nextGroup = group ? { ...group, sharedList: nextSharedList } : group;

    setGroup(nextGroup);
    queryClient.setQueryData(queryKeys.group.detail(id), nextGroup);
    applyEntityUpdate(queryClient, [queryKeys.group.list()], (current: { groups: GroupRecord[]; currentUser: UserProfile | null } | undefined) => {
      if (!current) return current;
      return {
        ...current,
        groups: current.groups.map((item) =>
          item.id === id ? { ...item, sharedList: nextSharedList } : item
        ),
      };
    });
    addInFlightOp(opId, {
      opId,
      type: "create",
      itemId: tmdbId,
      surface: "group",
      payload: { tmdbId },
    });

    try {
      const body = attachOpToBody({
        tmdbId,
        metadata: movie,
      }, { opId, type: "create", tempId: tmdbId, ts: Date.now() });
      const headers = attachOpToHeaders({ "Content-Type": "application/json" }, { opId, type: "create", tempId: tmdbId, ts: Date.now() });

      const response = await fetch(`/api/groups/${id}/movies`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        setGroup(previousGroup);
        queryClient.setQueryData(queryKeys.group.detail(id), previousGroup);
        applyEntityUpdate(queryClient, [queryKeys.group.list()], (current: { groups: GroupRecord[]; currentUser: UserProfile | null } | undefined) => {
          if (!current || !previousGroup) return current;
          return {
            ...current,
            groups: current.groups.map((item) =>
              item.id === id ? previousGroup : item
            ),
          };
        });
        const errorPayload = await response.json().catch(() => null);
        toast.error(errorPayload?.error || "Could not add movie.");
        return;
      }

      const savedMovie = await response.json().catch(() => null);
      if (savedMovie?.tmdbId) {
        const confirmedMovie = optimisticMovie;
        const confirmedSharedList = [confirmedMovie, ...(previousGroup?.sharedList ?? []).filter((item) => item.id !== tmdbId)];
        const confirmedGroup = previousGroup ? { ...previousGroup, sharedList: confirmedSharedList } : previousGroup;
        setGroup(confirmedGroup);
        queryClient.setQueryData(queryKeys.group.detail(id), confirmedGroup);
        applyEntityUpdate(queryClient, [queryKeys.group.list()], (current: { groups: GroupRecord[]; currentUser: UserProfile | null } | undefined) => {
          if (!current || !confirmedGroup) return current;
          return {
            ...current,
            groups: current.groups.map((item) =>
              item.id === id ? confirmedGroup : item
            ),
          };
        });
      }

      toast.success("Movie added to shared watchlist!");
      setAddMovieOpen(false);
    } catch (error) {
      setGroup(previousGroup);
      queryClient.setQueryData(queryKeys.group.detail(id), previousGroup);
      applyEntityUpdate(queryClient, [queryKeys.group.list()], (current: { groups: GroupRecord[]; currentUser: UserProfile | null } | undefined) => {
        if (!current || !previousGroup) return current;
        return {
          ...current,
          groups: current.groups.map((item) =>
            item.id === id ? previousGroup : item
          ),
        };
      });
      toast.error("Failed to add movie.");
    } finally {
      removeInFlightOp(opId);
    }
  };

  const handleRsvp = async (eventId: string, rsvpStatus: "yes" | "no" | "maybe" | "pending") => {
    if (!currentUser) {
      toast.error("Sign in to RSVP.");
      return;
    }

    const opId = generateOpId();
    const previousEvents = events;
    const nextEvents = events.map((event) => {
      if (event.id !== eventId) return event;

      const existingAttendees = event.attendees ?? [];
      const nextAttendees = existingAttendees.filter((attendee) => attendee.user?.id !== currentUser.id);

      if (rsvpStatus !== "pending") {
        nextAttendees.push({
          user: {
            id: currentUser.id,
            displayName: currentUser.displayName,
            username: currentUser.username,
            avatar: currentUser.avatar,
          },
          rsvpStatus,
        });
      }

      return { ...event, attendees: nextAttendees };
    });

    setEvents(nextEvents);
    queryClient.setQueryData(queryKeys.group.events(id), nextEvents);
    addInFlightOp(opId, {
      opId,
      type: "update",
      itemId: eventId,
      surface: "group",
      payload: { rsvpStatus },
    });

    try {
      const body = attachOpToBody({ rsvpStatus }, { opId, type: "update", tempId: eventId, ts: Date.now() });
      const headers = attachOpToHeaders({ "Content-Type": "application/json" }, { opId, type: "update", tempId: eventId, ts: Date.now() });

      const response = await fetch(`/api/groups/${id}/events/${eventId}/rsvp`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        setEvents(previousEvents);
        queryClient.setQueryData(queryKeys.group.events(id), previousEvents);
        toast.error(errorPayload?.error || "Could not update RSVP.");
        return;
      }

      const updatedEvent = await response.json().catch(() => null);
      if (updatedEvent?.id) {
        setEvents((currentEvents) => {
          const next = currentEvents.map((event) => (event.id === updatedEvent.id ? updatedEvent : event));
          queryClient.setQueryData(queryKeys.group.events(id), next);
          return next;
        });
      }
      toast.success(rsvpStatus === "pending" ? "RSVP cleared." : `Marked as ${rsvpStatus}.`);
    } catch (error) {
      setEvents(previousEvents);
      queryClient.setQueryData(queryKeys.group.events(id), previousEvents);
      toast.error("Failed to update RSVP.");
    }
    finally {
      removeInFlightOp(opId);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    const eventToDelete = events.find((event) => event.id === eventId);
    if (!eventToDelete) {
      return;
    }

    const confirmed = window.confirm("Delete this event?");
    if (!confirmed) {
      return;
    }

    const opId = generateOpId();
    const previousEvents = events;
    const nextEvents = events.filter((event) => event.id !== eventId);

    setEvents(nextEvents);
    queryClient.setQueryData(queryKeys.group.events(id), nextEvents);

    try {
      const body = attachOpToBody({}, { opId, type: "delete", tempId: eventId, ts: Date.now() });
      const headers = attachOpToHeaders({ "Content-Type": "application/json" }, { opId, type: "delete", tempId: eventId, ts: Date.now() });

      const response = await fetch(`/api/groups/${id}/events/${eventId}`, {
        method: "DELETE",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        setEvents(previousEvents);
        queryClient.setQueryData(queryKeys.group.events(id), previousEvents);
        toast.error(errorPayload?.error || "Could not delete event.");
        return;
      }

      toast.success("Event deleted.");
    } catch (error) {
      setEvents(previousEvents);
      queryClient.setQueryData(queryKeys.group.events(id), previousEvents);
      toast.error("Failed to delete event.");
    }
  };

  const movieLookup = new Map<string, Movie>(group.sharedList.map((movie) => [movie.id, movie]));

  return (
    <div className="pb-20 md:pb-0">
      <div className="relative border-b bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="container py-8">
          <Link href="/groups" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-3.5 w-3.5" /> All groups
          </Link>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center gap-6">
            {group.avatar ? (
              <img src={group.avatar} alt={group.name} className="h-24 w-24 rounded-2xl bg-muted ring-2 ring-primary/20" />
            ) : (
              <div className="h-24 w-24 rounded-2xl bg-muted ring-2 ring-primary/20" />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-3xl font-bold text-foreground">{group.name}</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{group.description}</p>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {group.memberCount} members</span>
                <span className="flex items-center gap-1"><Film className="h-3.5 w-3.5" /> {group.sharedList.length} shared films</span>
                <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {discussions.length} discussions</span>
              </div>
            </div>
            <Button onClick={handleJoin} variant={joined ? "secondary" : "default"} className="gap-2">
              {joined ? <><UserMinus className="h-4 w-4" /> Leave Group</> : <><UserPlus className="h-4 w-4" /> Join Group</>}
            </Button>
          </motion.div>
        </div>
      </div>

      <div className="container py-8">
        <Tabs value={activeTab} onValueChange={setTabAndUrl} className="space-y-6">
          <TabsList>
            <TabsTrigger value="discussions"><MessageCircle className="h-4 w-4 mr-1.5" /> Discussions</TabsTrigger>
            <TabsTrigger value="watchlist"><Film className="h-4 w-4 mr-1.5" /> Shared Watchlist</TabsTrigger>
            <TabsTrigger value="members"><Users className="h-4 w-4 mr-1.5" /> Members</TabsTrigger>
            <TabsTrigger value="events"><Calendar className="h-4 w-4 mr-1.5" /> Events</TabsTrigger>
          </TabsList>

          <TabsContent value="discussions" className="space-y-6">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-card p-3 card-shadow">
              <p className="text-xs text-muted-foreground">Sort discussions</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={discussionSort === "latest" ? "default" : "secondary"}
                  className="h-7 px-3 text-xs"
                  onClick={() => setDiscussionSort("latest")}
                >
                  Latest
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={discussionSort === "popular" ? "default" : "secondary"}
                  className="h-7 px-3 text-xs"
                  onClick={() => setDiscussionSort("popular")}
                >
                  Popular
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={discussionSort === "oldest" ? "default" : "secondary"}
                  className="h-7 px-3 text-xs"
                  onClick={() => setDiscussionSort("oldest")}
                >
                  Oldest
                </Button>
              </div>
            </div>

            <div className="rounded-xl bg-card p-5 card-shadow space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">Start a discussion</h3>
              </div>
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="What's the topic?" className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <Textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder="Share your thoughts with the club..." rows={3} />
              <div className="flex justify-end">
                <Button onClick={handlePost} className="gap-1.5" disabled={isInFlight(`group-discussion-${group?.id}`)}>
                  {isInFlight(`group-discussion-${group?.id}`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Post
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {sortedDiscussions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No discussions yet.</div>
              ) : sortedDiscussions.map((discussion, index) => {
                const movie = discussion.movieId ? movieLookup.get(discussion.movieId) ?? null : null;
                const isLiked = Boolean(discussion.likedByMe);
                const likeInFlight = Boolean(isInFlight(`group-like-${discussion.id}`));
                return (
                  <motion.div key={discussion.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="rounded-xl bg-card p-5 card-shadow hover:card-shadow-hover transition-shadow">
                    <div className="flex items-start gap-3">
                      {discussion.author.avatar ? (
                        <img src={discussion.author.avatar} alt={discussion.author.displayName} className="h-10 w-10 rounded-full bg-muted" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{discussion.author.displayName}</span>
                          <span title={format(new Date(discussion.date), "PPpp")} className="text-xs text-muted-foreground">· {formatDiscussionDate(discussion.date)}</span>
                          {discussion.pinned && <Badge variant="secondary" className="gap-1 text-[10px]"><Pin className="h-3 w-3" /> Pinned</Badge>}
                        </div>
                        <h4 className="font-semibold text-foreground mt-1">{discussion.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{discussion.body}</p>
                        {movie && (
                          <MoviePrefetchLink movieId={movie.id} href={`/movie/${movie.id}`} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-muted/50 p-2 hover:bg-muted transition-colors">
                            {movie.poster ? (
                              <img src={movie.poster} alt={movie.title} className="h-10 w-7 rounded object-cover" />
                            ) : (
                              <div className="h-10 w-7 rounded bg-muted" />
                            )}
                            <span className="text-xs font-medium text-foreground">{movie.title} ({movie.year})</span>
                          </MoviePrefetchLink>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <button
                            onClick={() => toggleLike(discussion.id)}
                            disabled={likeInFlight}
                            aria-busy={likeInFlight}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                              isLiked
                                ? "border-primary/40 bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:text-foreground"
                            } ${likeInFlight ? "border-primary/40 bg-primary/10 text-primary" : ""}`}
                          >
                            {likeInFlight ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-primary text-primary" : ""}`} />
                            )}
                            {discussion.likes}
                          </button>
                          <button
                            onClick={() => setExpandedReplies((prev) => ({ ...prev, [discussion.id]: !prev[discussion.id] }))}
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> {(discussion.replyItems?.length ?? discussion.replies)} replies
                          </button>
                        </div>
                        <div className="mt-4 space-y-3">
                          <div className="flex gap-2">
                            <Textarea
                              value={replyDrafts[discussion.id] ?? ""}
                              onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [discussion.id]: e.target.value }))}
                              placeholder="Write a reply..."
                              rows={2}
                              className="min-h-0"
                            />
                            <Button
                              size="sm"
                              className="self-end gap-1.5"
                              onClick={() => handleReply(discussion.id)}
                              disabled={isInFlight(`group-reply-${discussion.id}`)}
                            >
                                {isInFlight(`group-reply-${discussion.id}`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                Reply
                            </Button>
                          </div>
                          {(expandedReplies[discussion.id] || (discussion.replyItems?.length ?? 0) > 0) && (discussion.replyItems?.length ?? 0) > 0 && (
                            <div className="ml-4 border-l border-border pl-4 space-y-3">
                              {discussion.replyItems?.map((reply) => (
                                <div key={reply.id} className="flex gap-2">
                                  {reply.author.avatar ? (
                                    <img src={reply.author.avatar} alt={reply.author.displayName} className="h-7 w-7 rounded-full bg-muted flex-shrink-0" />
                                  ) : (
                                    <div className="h-7 w-7 rounded-full bg-muted flex-shrink-0" />
                                  )}
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-xs text-foreground">{reply.author.displayName}</span>
                                      <span className="text-[10px] text-muted-foreground" title={format(new Date(reply.date), "PPpp")}>
                                        {formatDiscussionDate(reply.date)}
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">{reply.body}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="watchlist" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {group.sharedList.length} film{group.sharedList.length !== 1 ? "s" : ""} shared by the club
              </p>
              <Dialog open={addMovieOpen} onOpenChange={(open) => {
                setAddMovieOpen(open);
                if (!open) {
                  setMovieSearch("");
                  setSearchResults([]);
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add Movie
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add a movie to the shared list</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search movies..."
                        value={movieSearch}
                        onChange={(e) => setMovieSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-1">
                      {searchLoading ? (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Searching...
                        </p>
                      ) : movieSearch.trim() === "" ? (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Type to search for movies
                        </p>
                      ) : searchResults.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          No movies found
                        </p>
                      ) : (
                        <AnimatePresence>
                          {searchResults.map((movie) => {
                            const alreadyAdded = group.sharedList.some(
                              (m) => m.id === movie.id
                            );
                            const isAdding = getInFlightByItemId(movie.id).some((op) => op.surface === "group" && op.type === "create");
                            return (
                              <motion.div
                                key={movie.id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                className="flex items-center gap-3 rounded-lg bg-muted/40 p-2 hover:bg-muted/60 transition-colors"
                              >
                                {movie.poster ? (
                                  <img
                                    src={movie.poster}
                                    alt={movie.title}
                                    className="h-14 w-10 rounded object-cover"
                                  />
                                ) : (
                                  <div className="h-14 w-10 rounded bg-muted" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-foreground truncate">
                                    {movie.title}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {movie.year}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant={alreadyAdded ? "secondary" : "default"}
                                  className="h-7 px-2 text-[10px]"
                                  onClick={() => handleAddMovie(movie)}
                                  disabled={alreadyAdded || isAdding}
                                >
                                  {alreadyAdded ? "Added" : isAdding ? "Adding..." : "Add"}
                                </Button>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setAddMovieOpen(false)}>
                      Done
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {group.sharedList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No movies in the shared watchlist yet. Click "Add Movie" to get started!
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {group.sharedList.map((m) => (
                  <div key={m.id} className="group relative">
                    <MoviePrefetchLink movieId={m.id} href={`/movie/${m.id}`} className="block">
                      {m.poster ? (
                        <img
                          src={m.poster}
                          alt={m.title}
                          className="w-full aspect-[2/3] object-cover rounded-lg poster-shadow group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full aspect-[2/3] rounded-lg bg-muted" />
                      )}
                      <p className="text-xs font-medium text-foreground mt-2 truncate">
                        {m.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{m.year}</p>
                    </MoviePrefetchLink>
                    {(() => {
                      const isRemoving = getInFlightByItemId(m.id).some((op) => op.surface === "group" && op.type === "delete");
                      return (
                    <button
                      onClick={() => handleRemoveMovie(m.id)}
                      disabled={isRemoving}
                      className={`absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-background/90 text-muted-foreground hover:text-foreground flex items-center justify-center transition-opacity disabled:cursor-not-allowed ${isRemoving ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                      title="Remove from list"
                    >
                      {isRemoving ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                    </button>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="members">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl bg-card p-4 card-shadow"
                >
                  <Link href={`/profile/${m.id}`} className="shrink-0">
                    {m.avatar ? (
                      <img
                        src={m.avatar}
                        alt={m.displayName}
                        className="h-12 w-12 rounded-full bg-muted"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-muted" />
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/profile/${m.id}`} className="block text-sm font-medium text-foreground truncate hover:text-primary transition-colors">
                      {m.displayName}
                    </Link>
                    <p className="text-[11px] text-muted-foreground truncate">@{m.username}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {m.followers.toLocaleString()} followers · {m.following.toLocaleString()} following
                    </p>
                  </div>
                  {currentUser?.id === m.id ? (
                    <Badge variant="secondary" className="text-[10px]">
                      You
                    </Badge>
                  ) : currentUser ? (
                    <FollowButton
                      userId={m.id}
                      initialFollowing={Boolean(m.isFollowing)}
                      onFollowingChange={(isFollowing) => {
                        setGroup((currentGroup) =>
                          currentGroup
                            ? {
                                ...currentGroup,
                                members: currentGroup.members.map((member) =>
                                  member.id === m.id
                                    ? { ...member, isFollowing }
                                    : member
                                ),
                              }
                            : currentGroup
                        );
                      }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {events.length} upcoming event{events.length !== 1 ? "s" : ""}
              </p>
              <Dialog open={createEventOpen} onOpenChange={setCreateEventOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Create Event
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create a group event</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="ev-title">Event title</Label>
                      <Input
                        id="ev-title"
                        value={eventTitle}
                        onChange={(e) => setEventTitle(e.target.value)}
                        placeholder="e.g. Watch Party: The Hollow"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="ev-date">Date</Label>
                        <Input
                          id="ev-date"
                          type="date"
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          placeholder="YYYY-MM-DD"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ev-time">Time</Label>
                        <Input
                          id="ev-time"
                          type="time"
                          value={eventTime}
                          onChange={(e) => setEventTime(e.target.value)}
                          placeholder="HH:MM"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ev-location">Location / Platform</Label>
                      <Input
                        id="ev-location"
                        value={eventLocation}
                        onChange={(e) => setEventLocation(e.target.value)}
                        placeholder="e.g. Discord, Cinema, Zoom"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ev-desc">Description</Label>
                      <Textarea
                        id="ev-desc"
                        value={eventDescription}
                        onChange={(e) => setEventDescription(e.target.value)}
                        placeholder="What's happening?"
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setCreateEventOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateEvent}>Create Event</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {events.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No upcoming events. Create one to get the group together!
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((e: any, index: number) => (
                  (() => {
                    const rsvpInFlight = getInFlightByItemId(e.id).some((op) => op.surface === "group" && op.type === "update");
                    const attendeeCount = e.attendees?.filter((a: any) => a.rsvpStatus === "yes" || a.rsvpStatus === "maybe").length ?? 0;

                    return (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-start gap-4 rounded-xl bg-card p-4 card-shadow transition-all ${rsvpInFlight ? "ring-2 ring-primary/20 bg-primary/5" : ""}`}
                  >
                    <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {e.title}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Clock className="h-3 w-3" />
                            {e.startDate} · {e.startTime}
                          </Badge>
                          {(currentUser?.id === e.creator?.id || currentUser?.id === group.creatorId) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteEvent(e.id)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Hosted by {e.creator?.displayName || e.creator?.username || "Unknown"}
                      </p>
                      {e.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {e.description}
                        </p>
                      )}
                      {e.location && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {e.location}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium border ${rsvpInFlight ? "border-primary/30 bg-primary/10 text-primary animate-pulse" : "border-border text-muted-foreground"}`}>
                          {rsvpInFlight ? <Loader2 className="h-3 w-3 animate-spin" /> : <Users className="h-3 w-3" />}
                          {attendeeCount} attending
                          {rsvpInFlight ? " updating" : ""}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {(["yes", "maybe", "no"] as const).map((status) => {
                          const currentRsvp = e.attendees?.find((attendee: any) => attendee.user?.id === currentUser?.id)?.rsvpStatus;
                          const isActive = currentRsvp === status;

                          return (
                            <Button
                              key={status}
                              size="sm"
                              variant={isActive ? "default" : "secondary"}
                              className="h-7 px-3 text-xs capitalize"
                              disabled={rsvpInFlight}
                              onClick={() => handleRsvp(e.id, status)}
                            >
                              {status}
                            </Button>
                          );
                        })}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-3 text-xs"
                          disabled={rsvpInFlight}
                          onClick={() => handleRsvp(e.id, "pending")}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                    );
                  })()
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
