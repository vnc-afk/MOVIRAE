"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
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
import { groups, users, movies } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Discussion {
  id: string;
  author: typeof users[number];
  title: string;
  body: string;
  date: string;
  likes: number;
  replies: number;
  pinned?: boolean;
  movieId?: string;
}

const seedDiscussions = (groupId: string): Discussion[] => [
  {
    id: `${groupId}-d1`,
    author: users[0],
    title: "This week's pick: Midnight Rain — first impressions?",
    body: "Just finished the first act and the cinematography already has me hooked. Curious what everyone thinks about the pacing.",
    date: "2 hours ago",
    likes: 24,
    replies: 8,
    pinned: true,
    movieId: "1",
  },
  {
    id: `${groupId}-d2`,
    author: users[1],
    title: "Best 'rain in a movie' scenes — drop yours",
    body: "Building a supercut. Bonus points for neon. Go!",
    date: "Yesterday",
    likes: 17,
    replies: 12,
  },
  {
    id: `${groupId}-d3`,
    author: users[2],
    title: "Voting open: next month's club pick 🎬",
    body: "Three nominees in the comments — react with the emoji of your choice.",
    date: "3 days ago",
    likes: 31,
    replies: 22,
  },
];

export default function GroupDetail() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const group = groups.find((g) => g.id === id);
  const [joined, setJoined] = useState(false);
  const [discussions, setDiscussions] = useState<Discussion[]>(
    seedDiscussions(id ?? "g")
  );
  const [newTitle, setNewTitle] = useState(""
  );
  const [newBody, setNewBody] = useState("");
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  if (!group) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground">Group not found.</p>
        <Button className="mt-4" onClick={() => router.push("/groups")}>
          Back to Groups
        </Button>
      </div>
    );
  }

  const handleJoin = () => {
    setJoined((j) => !j);
    toast.success(joined ? `Left ${group.name}` : `Welcome to ${group.name}!`);
  };

  const handlePost = () => {
    if (!newTitle.trim() || !newBody.trim()) {
      toast.error("Add a title and a message before posting.");
      return;
    }
    setDiscussions((d) => [
      {
        id: `${group.id}-new-${Date.now()}`,
        author: users[0],
        title: newTitle,
        body: newBody,
        date: "Just now",
        likes: 0,
        replies: 0,
      },
      ...d,
    ]);
    setNewTitle("");
    setNewBody("");
    toast.success("Discussion posted!");
  };

  const toggleLike = (did: string) => {
    setLiked((prev) => ({ ...prev, [did]: !prev[did] }));
    setDiscussions((ds) =>
      ds.map((d) =>
        d.id === did
          ? { ...d, likes: d.likes + (liked[did] ? -1 : 1) }
          : d
      )
    );
  };

  return (
    <div className="pb-20 md:pb-0">
      <div className="relative border-b bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="container py-8">
          <Link
            href="/groups"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All groups
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row md:items-center gap-6"
          >
            <img
              src={group.avatar}
              alt={group.name}
              className="h-24 w-24 rounded-2xl bg-muted ring-2 ring-primary/20"
            />
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-3xl font-bold text-foreground">
                {group.name}
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                {group.description}
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {group.memberCount + (joined ? 1 : 0)} members
                </span>
                <span className="flex items-center gap-1">
                  <Film className="h-3.5 w-3.5" />
                  {group.sharedList.length} shared films
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {discussions.length} discussions
                </span>
              </div>
            </div>
            <Button
              onClick={handleJoin}
              variant={joined ? "secondary" : "default"}
              className="gap-2"
            >
              {joined ? (
                <>
                  <UserMinus className="h-4 w-4" /> Leave Group
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" /> Join Group
                </>
              )}
            </Button>
          </motion.div>
        </div>
      </div>

      <div className="container py-8">
        <Tabs defaultValue="discussions" className="space-y-6">
          <TabsList>
            <TabsTrigger value="discussions">
              <MessageCircle className="h-4 w-4 mr-1.5" /> Discussions
            </TabsTrigger>
            <TabsTrigger value="watchlist">
              <Film className="h-4 w-4 mr-1.5" /> Shared Watchlist
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users className="h-4 w-4 mr-1.5" /> Members
            </TabsTrigger>
            <TabsTrigger value="events">
              <Calendar className="h-4 w-4 mr-1.5" /> Events
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discussions" className="space-y-6">
            <div className="rounded-xl bg-card p-5 card-shadow space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">
                  Start a discussion
                </h3>
              </div>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="What's the topic?"
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Share your thoughts with the club…"
                rows={3}
              />
              <div className="flex justify-end">
                <Button onClick={handlePost} className="gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Post
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {discussions.map((d, i) => {
                const movie = d.movieId
                  ? movies.find((m) => m.id === d.movieId)
                  : null;
                return (
                  <motion.div
                    key={d.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl bg-card p-5 card-shadow hover:card-shadow-hover transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={d.author.avatar}
                        alt={d.author.displayName}
                        className="h-10 w-10 rounded-full bg-muted"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">
                            {d.author.displayName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            · {d.date}
                          </span>
                          {d.pinned && (
                            <Badge
                              variant="secondary"
                              className="gap-1 text-[10px]"
                            >
                              <Pin className="h-3 w-3" /> Pinned
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-semibold text-foreground mt-1">
                          {d.title}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {d.body}
                        </p>
                        {movie && (
                          <Link
                            href={`/movie/${movie.id}`}
                            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-muted/50 p-2 hover:bg-muted transition-colors"
                          >
                            <img
                              src={movie.poster}
                              alt={movie.title}
                              className="h-10 w-7 rounded object-cover"
                            />
                            <span className="text-xs font-medium text-foreground">
                              {movie.title} ({movie.year})
                            </span>
                          </Link>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <button
                            onClick={() => toggleLike(d.id)}
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                          >
                            <Heart
                              className={`h-3.5 w-3.5 ${
                                liked[d.id]
                                  ? "fill-primary text-primary"
                                  : ""
                              }`}
                            />
                            {d.likes}
                          </button>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-3.5 w-3.5" />
                            {d.replies} replies
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="watchlist">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from(
                new Map(
                  [
                    ...group.sharedList,
                    ...movies.slice(0, 4),
                  ].map((m) => [m.id, m])
                ).values()
              )
                .slice(0, 8)
                .map((m) => (
                  <Link
                    key={m.id}
                    href={`/movie/${m.id}`}
                    className="group"
                  >
                    <img
                      src={m.poster}
                      alt={m.title}
                      className="w-full aspect-[2/3] object-cover rounded-lg poster-shadow group-hover:scale-105 transition-transform"
                    />
                    <p className="text-xs font-medium text-foreground mt-2 truncate">
                      {m.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {m.year}
                    </p>
                  </Link>
                ))}
            </div>
          </TabsContent>

          <TabsContent value="members">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...group.members, ...users].slice(0, 9).map((m, i) => (
                <div
                  key={`${m.id}-${i}`}
                  className="flex items-center gap-3 rounded-xl bg-card p-4 card-shadow"
                >
                  <img
                    src={m.avatar}
                    alt={m.displayName}
                    className="h-12 w-12 rounded-full bg-muted"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {m.displayName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      @{m.username}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost">
                    Follow
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="events" className="space-y-3">
            {[
              {
                title: "Watch Party: Midnight Rain",
                when: "Friday · 8:00 PM",
                host: users[0],
              },
              {
                title: "Monthly Pick Vote",
                when: "Sunday · 6:00 PM",
                host: users[1],
              },
            ].map((e) => (
              <div
                key={e.title}
                className="flex items-center gap-4 rounded-xl bg-card p-4 card-shadow"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {e.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {e.when} · hosted by {e.host.displayName}
                  </p>
                </div>
                <Button size="sm">RSVP</Button>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
