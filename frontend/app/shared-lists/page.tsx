"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ListPlus, Plus, Users, Lock, Globe, Heart, MessageCircle,
  MoreHorizontal, Trash2, UserPlus, Film, Check, X, GripVertical,
} from "lucide-react";
import { movies, users, groups, type Movie, type UserProfile } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface SharedList {
  id: string;
  name: string;
  description: string;
  visibility: "public" | "private" | "group";
  owner: UserProfile;
  collaborators: UserProfile[];
  movies: Movie[];
  likes: number;
  comments: number;
  createdAt: string;
  groupId?: string;
}

const mockSharedLists: SharedList[] = [
  {
    id: "sl1",
    name: "Best Thrillers of 2024–25",
    description: "Our curated picks for the most gripping thrillers. Constantly updated by the crew.",
    visibility: "public",
    owner: users[0],
    collaborators: [users[1], users[2]],
    movies: [movies[0], movies[3], movies[5]],
    likes: 87,
    comments: 14,
    createdAt: "2 weeks ago",
  },
  {
    id: "sl2",
    name: "Friday Night Picks",
    description: "Our go-to list for weekend movie nights. Everyone adds, everyone votes!",
    visibility: "group",
    owner: users[1],
    collaborators: [users[0], users[2]],
    movies: [movies[1], movies[4], movies[2]],
    likes: 42,
    comments: 8,
    createdAt: "1 month ago",
    groupId: "g3",
  },
  {
    id: "sl3",
    name: "Hidden Gems Only",
    description: "Under-the-radar films that deserve more love. No blockbusters allowed.",
    visibility: "private",
    owner: users[2],
    collaborators: [users[0]],
    movies: [movies[2], movies[4]],
    likes: 23,
    comments: 5,
    createdAt: "3 days ago",
  },
  {
    id: "sl4",
    name: "Sci-Fi Society Essentials",
    description: "The definitive list curated by our club. From classics to new releases.",
    visibility: "group",
    owner: users[0],
    collaborators: [users[2]],
    movies: [movies[2], movies[5], movies[0], movies[4]],
    likes: 156,
    comments: 31,
    createdAt: "2 months ago",
    groupId: "g2",
  },
];

const visibilityConfig = {
  public: { icon: Globe, label: "Public", color: "text-green-500" },
  private: { icon: Lock, label: "Private", color: "text-amber-500" },
  group: { icon: Users, label: "Group", color: "text-blue-500" },
};

function ListCard({ list, index }: { list: SharedList; index: number }) {
  const vis = visibilityConfig[list.visibility];
  const VisIcon = vis.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-xl bg-card p-5 card-shadow hover:card-shadow-hover transition-all duration-300 group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{list.name}</h3>
            <Badge variant="outline" className={`text-[10px] gap-1 ${vis.color}`}>
              <VisIcon className="h-2.5 w-2.5" /> {vis.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{list.description}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="gap-2"><UserPlus className="h-3.5 w-3.5" /> Invite Collaborator</DropdownMenuItem>
            <DropdownMenuItem className="gap-2"><Film className="h-3.5 w-3.5" /> Add Movie</DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete List</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Movie posters strip */}
      <div className="flex gap-2 mt-4 overflow-hidden">
        {list.movies.slice(0, 5).map((movie) => (
          <Link key={movie.id} href={`/movie/${movie.id}`} className="flex-shrink-0">
            <img
              src={movie.poster}
              alt={movie.title}
              className="h-20 w-14 rounded-md object-cover poster-shadow hover:scale-105 transition-transform duration-200"
            />
          </Link>
        ))}
        {list.movies.length > 5 && (
          <div className="h-20 w-14 rounded-md bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground flex-shrink-0">
            +{list.movies.length - 5}
          </div>
        )}
      </div>

      {/* Owner & collaborators */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={list.owner.avatar} />
            <AvatarFallback>{list.owner.displayName[0]}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">{list.owner.displayName}</span>
          {list.collaborators.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground">+</span>
              <div className="flex -space-x-1.5">
                {list.collaborators.slice(0, 3).map((c) => (
                  <Avatar key={c.id} className="h-5 w-5 border border-card">
                    <AvatarImage src={c.avatar} />
                    <AvatarFallback className="text-[8px]">{c.displayName[0]}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">{list.createdAt}</span>
      </div>

      {/* Stats & actions */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Film className="h-3 w-3" /> {list.movies.length} films</span>
          <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {list.likes}</span>
          <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {list.comments}</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1 hover:text-primary"
          onClick={() => toast.success("Liked this list!")}
        >
          <Heart className="h-3 w-3" /> Like
        </Button>
      </div>
    </motion.div>
  );
}

function CreateListDialog() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [selectedMovies, setSelectedMovies] = useState<Movie[]>([]);
  const [movieSearch, setMovieSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filteredMovies = movies.filter(
    (m) =>
      m.title.toLowerCase().includes(movieSearch.toLowerCase()) &&
      !selectedMovies.some((s) => s.id === m.id)
  );

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error("Please enter a list name");
      return;
    }
    toast.success(`"${name}" created! Invite friends to collaborate.`);
    setOpen(false);
    setName("");
    setDescription("");
    setSelectedMovies([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> New Shared List
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="h-5 w-5 text-primary" /> Create Shared List
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium text-foreground">List Name</label>
            <Input
              placeholder="e.g., Weekend Watchlist"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Description</label>
            <Textarea
              placeholder="What's this list about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
              rows={2}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Visibility</label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public"><span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-green-500" /> Public</span></SelectItem>
                <SelectItem value="private"><span className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-amber-500" /> Private</span></SelectItem>
                <SelectItem value="group"><span className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-blue-500" /> Group Only</span></SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Add movies */}
          <div>
            <label className="text-sm font-medium text-foreground">Add Movies</label>
            <Input
              placeholder="Search movies to add..."
              value={movieSearch}
              onChange={(e) => setMovieSearch(e.target.value)}
              className="mt-1"
            />
            {movieSearch && filteredMovies.length > 0 && (
              <div className="mt-2 rounded-lg border border-border bg-popover p-1 max-h-32 overflow-y-auto">
                {filteredMovies.slice(0, 5).map((movie) => (
                  <button
                    key={movie.id}
                    onClick={() => {
                      setSelectedMovies((prev) => [...prev, movie]);
                      setMovieSearch("");
                    }}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-left hover:bg-accent transition-colors"
                  >
                    <img src={movie.poster} alt="" className="h-8 w-6 rounded object-cover" />
                    <span className="text-foreground">{movie.title}</span>
                    <span className="text-muted-foreground text-xs ml-auto">{movie.year}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected movies */}
            {selectedMovies.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedMovies.map((movie) => (
                  <Badge key={movie.id} variant="secondary" className="gap-1.5 pr-1">
                    {movie.title}
                    <button
                      onClick={() => setSelectedMovies((prev) => prev.filter((m) => m.id !== movie.id))}
                      className="h-4 w-4 rounded-full hover:bg-destructive/20 flex items-center justify-center"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Invite collaborators */}
          <div>
            <label className="text-sm font-medium text-foreground">Invite Collaborators</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {users.slice(1).map((user) => (
                <button
                  key={user.id}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-xs"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback className="text-[8px]">{user.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-foreground">{user.displayName}</span>
                  <UserPlus className="h-3 w-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleCreate} className="w-full gap-2">
            <Check className="h-4 w-4" /> Create List
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SharedLists() {
  const [tab, setTab] = useState("all");

  const myLists = mockSharedLists.filter((l) => l.owner.id === users[0].id);
  const collaborating = mockSharedLists.filter((l) =>
    l.collaborators.some((c) => c.id === users[0].id)
  );
  const groupLists = mockSharedLists.filter((l) => l.groupId);

  const displayLists =
    tab === "mine" ? myLists :
    tab === "collaborating" ? collaborating :
    tab === "group" ? groupLists :
    mockSharedLists;

  return (
    <div className="pb-20 md:pb-0">
      <div className="container py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between flex-wrap gap-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ListPlus className="h-5 w-5 text-primary" />
              <h1 className="font-display text-2xl font-bold text-foreground">
                Shared Lists
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Co-create watchlists with friends, groups, or the community.
            </p>
          </div>
          <CreateListDialog />
        </motion.div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-secondary">
            <TabsTrigger value="all" className="gap-1.5 text-xs">
              <Globe className="h-3 w-3" /> All
            </TabsTrigger>
            <TabsTrigger value="mine" className="gap-1.5 text-xs">
              <Film className="h-3 w-3" /> My Lists
            </TabsTrigger>
            <TabsTrigger value="collaborating" className="gap-1.5 text-xs">
              <Users className="h-3 w-3" /> Collaborating
            </TabsTrigger>
            <TabsTrigger value="group" className="gap-1.5 text-xs">
              <Users className="h-3 w-3" /> Group Lists
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <TabsContent value={tab} className="mt-6">
              {displayLists.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-5">
                  {displayLists.map((list, i) => (
                    <ListCard key={list.id} list={list} index={i} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <ListPlus className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No lists here yet. Create one to get started!</p>
                </div>
              )}
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  );
}