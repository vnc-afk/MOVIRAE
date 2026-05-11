"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Group, Movie, UserProfile } from "@/lib/types";

interface Discussion {
  id: string;
  author: UserProfile;
  title: string;
  body: string;
  date: string;
  likes: number;
  replies: number;
  pinned?: boolean;
  movieId?: string;
}

type GroupRecord = Group & { discussions?: Discussion[]; joined?: boolean };

export default function GroupDetail() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [group, setGroup] = useState<GroupRecord | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [joined, setJoined] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/data/groups").then((response) => response.json()),
      fetch("/api/users").then((response) => response.json()),
    ])
      .then(([groupsResponse, usersResponse]) => {
        const groups = Array.isArray(groupsResponse.value) ? groupsResponse.value : [];
        setGroup(groups.find((item: GroupRecord) => item.id === id) ?? null);
        const users = Array.isArray(usersResponse.value) ? usersResponse.value : [];
        setCurrentUser(users[0] ?? null);
      })
      .catch((error) => console.error("Failed to load group detail:", error));
  }, [id]);

  useEffect(() => {
    if (group) {
      setJoined(Boolean(group.joined));
    }
  }, [group]);

  if (!group) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground">Group not found.</p>
        <Button className="mt-4" onClick={() => router.push("/groups")}>Back to Groups</Button>
      </div>
    );
  }

  const discussions = group.discussions ?? [];

  const persistGroup = async (nextGroup: GroupRecord) => {
    const response = await fetch("/api/data/groups");
    const payload = await response.json();
    const groups = Array.isArray(payload.value) ? payload.value : [];
    const nextGroups = groups.map((item: GroupRecord) => (item.id === nextGroup.id ? nextGroup : item));
    await fetch("/api/data/groups", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextGroups),
    });
    setGroup(nextGroup);
  };

  const handleJoin = async () => {
    const nextJoined = !joined;
    setJoined(nextJoined);
    await persistGroup({
      ...group,
      joined: nextJoined,
    });
    toast.success(nextJoined ? `Welcome to ${group.name}!` : `Left ${group.name}`);
  };

  const handlePost = async () => {
    if (!newTitle.trim() || !newBody.trim() || !currentUser) {
      toast.error("Add a title and a message before posting.");
      return;
    }

    const nextDiscussions: Discussion[] = [
      {
        id: `${group.id}-new-${Date.now()}`,
        author: currentUser,
        title: newTitle,
        body: newBody,
        date: "Just now",
        likes: 0,
        replies: 0,
      },
      ...discussions,
    ];

    await persistGroup({
      ...group,
      discussions: nextDiscussions,
    });
    setNewTitle("");
    setNewBody("");
    toast.success("Discussion posted!");
  };

  const toggleLike = async (discussionId: string) => {
    const nextLiked = !liked[discussionId];
    setLiked((prev) => ({ ...prev, [discussionId]: nextLiked }));

    const nextDiscussions = discussions.map((discussion) =>
      discussion.id === discussionId
        ? { ...discussion, likes: discussion.likes + (nextLiked ? 1 : -1) }
        : discussion
    );

    await persistGroup({
      ...group,
      discussions: nextDiscussions,
    });
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
            <img src={group.avatar} alt={group.name} className="h-24 w-24 rounded-2xl bg-muted ring-2 ring-primary/20" />
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-3xl font-bold text-foreground">{group.name}</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{group.description}</p>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {group.memberCount + (joined ? 1 : 0)} members</span>
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
                      <img src={discussion.author.avatar} alt={discussion.author.displayName} className="h-10 w-10 rounded-full bg-muted" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{discussion.author.displayName}</span>
                          <span className="text-xs text-muted-foreground">· {discussion.date}</span>
                          {discussion.pinned && <Badge variant="secondary" className="gap-1 text-[10px]"><Pin className="h-3 w-3" /> Pinned</Badge>}
                        </div>
                        <h4 className="font-semibold text-foreground mt-1">{discussion.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{discussion.body}</p>
                        {movie && (
                          <Link href={`/movie/${movie.id}`} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-muted/50 p-2 hover:bg-muted transition-colors">
                            <img src={movie.poster} alt={movie.title} className="h-10 w-7 rounded object-cover" />
                            <span className="text-xs font-medium text-foreground">{movie.title} ({movie.year})</span>
                          </Link>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <button onClick={() => toggleLike(discussion.id)} className="flex items-center gap-1 hover:text-foreground transition-colors">
                            <Heart className={`h-3.5 w-3.5 ${liked[discussion.id] ? "fill-primary text-primary" : ""}`} />
                            {discussion.likes}
                          </button>
                          <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {discussion.replies} replies</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="watchlist" className="space-y-4">
            {group.sharedList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No shared watchlist items yet.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {group.sharedList.map((movie) => (
                  <Link key={movie.id} href={`/movie/${movie.id}`} className="block">
                    <img src={movie.poster} alt={movie.title} className="w-full rounded-lg object-cover poster-shadow" />
                    <p className="mt-2 text-xs text-foreground truncate">{movie.title}</p>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="members" className="space-y-3">
            {group.members.map((member) => (
              <div key={member.id} className="rounded-xl bg-card p-4 card-shadow flex items-center gap-3">
                <img src={member.avatar} alt={member.displayName} className="h-10 w-10 rounded-full bg-muted" />
                <div>
                  <p className="font-semibold text-foreground">{member.displayName}</p>
                  <p className="text-xs text-muted-foreground">@{member.username}</p>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="events">
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No upcoming events yet.</div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
