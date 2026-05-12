"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  Users,
  Film,
  MessageCircle,
  ArrowLeft,
  Send,
  Heart,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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
import type { Group, Movie, UserProfile } from "@/lib/types";

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
  likedBy?: string[];
  replyItems?: DiscussionReply[];
  pinned?: boolean;
  movieId?: string;
}

type GroupRecord = Group & { discussions?: Discussion[]; joined?: boolean };
type LoadState = "loading" | "ready" | "not-found" | "error";
type GroupDetailResponse = { value?: GroupRecord | null; currentUser?: UserProfile | null };

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
  const [group, setGroup] = useState<GroupRecord | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [joined, setJoined] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
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
  const [events, setEvents] = useState<any[]>([]);
  const [addMovieOpen, setAddMovieOpen] = useState(false);
  const [movieSearch, setMovieSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

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
          const newEvents = Array.isArray(eventsPayload.value) ? eventsPayload.value : [];
          setEvents(newEvents);
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
    eventSource.addEventListener("group-updated", () => {
      if (!isActive) return;

      loadGroup(false).catch((error) => {
        console.error("Failed to refresh group detail:", error);
      });
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

  const discussions = group.discussions ?? [];

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

    const response = await fetch(`/api/groups/${id}/discussions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, body: newBody }),
    });

    if (!response.ok) {
      toast.error("Could not post the discussion.");
      return;
    }

    await refreshGroupFromResponse(response);
    setNewTitle("");
    setNewBody("");
    toast.success("Discussion posted!");
  };

  const toggleLike = async (discussionId: string) => {
    if (!currentUser) {
      toast.error("Sign in to like a discussion.");
      return;
    }

    const response = await fetch(`/api/groups/${id}/discussions/${discussionId}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      toast.error("Could not update the like.");
      return;
    }

    await refreshGroupFromResponse(response);
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

    const response = await fetch(`/api/groups/${id}/discussions/${discussionId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: replyBody }),
    });

    if (!response.ok) {
      toast.error("Could not post the reply.");
      return;
    }

    await refreshGroupFromResponse(response);

    setReplyDrafts((prev) => ({ ...prev, [discussionId]: "" }));
    setExpandedReplies((prev) => ({ ...prev, [discussionId]: true }));
    toast.success("Reply posted!");
  };

  const handleCreateEvent = async () => {
    if (!eventTitle.trim() || !eventDate.trim() || !eventTime.trim()) {
      toast.error("Please fill in the event title, date, and time.");
      return;
    }

    try {
      const response = await fetch(`/api/groups/${id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: eventTitle,
          description: eventDescription,
          startDate: eventDate,
          startTime: eventTime,
          location: eventLocation,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        toast.error(errorPayload?.error || "Could not create event.");
        return;
      }

      const eventsResponse = await fetch(`/api/groups/${id}/events?data=1`, { cache: "no-store" });
      const eventsPayload = await eventsResponse.json();
      const newEvents = Array.isArray(eventsPayload.value) ? eventsPayload.value : [];
      setEvents(newEvents);

      setEventTitle("");
      setEventDate("");
      setEventTime("");
      setEventLocation("");
      setEventDescription("");
      setCreateEventOpen(false);
      toast.success("Event created!");
    } catch (error) {
      toast.error("Failed to create event.");
    }
  };

  const handleRemoveMovie = async (movieId: string) => {
    try {
      const response = await fetch(`/api/groups/${id}/movies/${movieId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        toast.error("Could not remove movie.");
        return;
      }

      await loadGroup(false);
      toast.success("Movie removed from shared list.");
    } catch (error) {
      toast.error("Failed to remove movie.");
    }
  };

  const handleAddMovie = async (tmdbId: string) => {
    try {
      const response = await fetch(`/api/groups/${id}/movies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId }),
      });

      if (!response.ok) {
        toast.error("Could not add movie.");
        return;
      }

      await loadGroup(false);
      toast.success("Movie added to shared watchlist!");
      setAddMovieOpen(false);
    } catch (error) {
      toast.error("Failed to add movie.");
    }
  };

  const handleRsvp = async (eventId: string, rsvpStatus: "yes" | "no" | "maybe" | "pending") => {
    if (!currentUser) {
      toast.error("Sign in to RSVP.");
      return;
    }

    try {
      const response = await fetch(`/api/groups/${id}/events/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rsvpStatus }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        toast.error(errorPayload?.error || "Could not update RSVP.");
        return;
      }

      const eventsResponse = await fetch(`/api/groups/${id}/events?data=1`, { cache: "no-store" });
      const eventsPayload = await eventsResponse.json();
      const newEvents = Array.isArray(eventsPayload.value) ? eventsPayload.value : [];
      setEvents(newEvents);
      toast.success(rsvpStatus === "pending" ? "RSVP cleared." : `Marked as ${rsvpStatus}.`);
    } catch (error) {
      toast.error("Failed to update RSVP.");
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
        <Tabs defaultValue="discussions" className="space-y-6">
          <TabsList>
            <TabsTrigger value="discussions"><MessageCircle className="h-4 w-4 mr-1.5" /> Discussions</TabsTrigger>
            <TabsTrigger value="watchlist"><Film className="h-4 w-4 mr-1.5" /> Shared Watchlist</TabsTrigger>
            <TabsTrigger value="members"><Users className="h-4 w-4 mr-1.5" /> Members</TabsTrigger>
            <TabsTrigger value="events"><Calendar className="h-4 w-4 mr-1.5" /> Events</TabsTrigger>
          </TabsList>

          <TabsContent value="discussions" className="space-y-6">
            <div className="rounded-xl bg-card p-5 card-shadow space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">Start a discussion</h3>
              </div>
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="What's the topic?" className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <Textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder="Share your thoughts with the club..." rows={3} />
              <div className="flex justify-end"><Button onClick={handlePost} className="gap-1.5"><Send className="h-3.5 w-3.5" /> Post</Button></div>
            </div>

            <div className="space-y-3">
              {discussions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No discussions yet.</div>
              ) : discussions.map((discussion, index) => {
                const movie = discussion.movieId ? movieLookup.get(discussion.movieId) ?? null : null;
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
                          <Link href={`/movie/${movie.id}`} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-muted/50 p-2 hover:bg-muted transition-colors">
                            {movie.poster ? (
                              <img src={movie.poster} alt={movie.title} className="h-10 w-7 rounded object-cover" />
                            ) : (
                              <div className="h-10 w-7 rounded bg-muted" />
                            )}
                            <span className="text-xs font-medium text-foreground">{movie.title} ({movie.year})</span>
                          </Link>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <button onClick={() => toggleLike(discussion.id)} className="flex items-center gap-1 hover:text-foreground transition-colors">
                            <Heart className={`h-3.5 w-3.5 ${(currentUser && (discussion.likedBy ?? []).includes(currentUser.id)) ? "fill-primary text-primary" : ""}`} />
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
                            <Button size="sm" className="self-end gap-1.5" onClick={() => handleReply(discussion.id)}>
                              <Send className="h-3.5 w-3.5" />
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
                                  onClick={() => handleAddMovie(movie.id)}
                                  disabled={alreadyAdded}
                                >
                                  {alreadyAdded ? "Added" : "Add"}
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
                    <Link href={`/movie/${m.id}`} className="block">
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
                    </Link>
                    <button
                      onClick={() => handleRemoveMovie(m.id)}
                      className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-background/90 text-muted-foreground hover:text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove from list"
                    >
                      <X className="h-3 w-3" />
                    </button>
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
                  {m.avatar ? (
                    <img
                      src={m.avatar}
                      alt={m.displayName}
                      className="h-12 w-12 rounded-full bg-muted"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {m.displayName}
                    </p>
                  </div>
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
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-4 rounded-xl bg-card p-4 card-shadow"
                  >
                    <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {e.title}
                        </p>
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Clock className="h-3 w-3" />
                          {e.startDate} · {e.startTime}
                        </Badge>
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
                        <span className="text-[10px] text-muted-foreground">
                          {e.attendees?.filter((a: any) => a.rsvpStatus === "yes" || a.rsvpStatus === "maybe").length ?? 0} attending
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
                          onClick={() => handleRsvp(e.id, "pending")}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
