"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ListPlus,
  Plus,
  Users,
  Lock,
  Globe,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Trash2,
  UserPlus,
  Film,
  Check,
  X,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { Group, Movie, SharedList, UserProfile } from "@/lib/types";

const visibilityConfig = {
  public: { icon: Globe, label: "Public", color: "text-green-500" },
  private: { icon: Lock, label: "Private", color: "text-amber-500" },
  group: { icon: Users, label: "Group", color: "text-blue-500" },
};

export default function SharedListsPage() {
  const [lists, setLists] = useState<SharedList[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  const [openCreate, setOpenCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newVisibility, setNewVisibility] = useState<"public" | "private" | "group">("public");
  const [newGroupId, setNewGroupId] = useState<string>("");

  useEffect(() => {
    Promise.all([
      fetch("/api/data/shared-lists").then((response) => response.json()),
      fetch("/api/users").then((response) => response.json()),
      fetch("/api/data/groups").then((response) => response.json()),
    ])
      .then(([listsResponse, usersResponse, groupsResponse]) => {
        setLists(Array.isArray(listsResponse.value) ? listsResponse.value : []);
        setUsers(Array.isArray(usersResponse.value) ? usersResponse.value : []);
        setGroups(Array.isArray(groupsResponse.value) ? groupsResponse.value : []);
      })
      .catch((error) => console.error("Failed to load shared lists:", error));
  }, []);

  const currentUser = users[0] ?? null;

  const persistLists = async (nextLists: SharedList[]) => {
    setLists(nextLists);
    await fetch("/api/data/shared-lists", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextLists),
    });
  };

  const removeList = async (id: string) => {
    const nextLists = lists.filter((list) => list.id !== id);
    await persistLists(nextLists);
    toast.success("List removed");
  };

  const toggleLike = async (list: SharedList) => {
    const nowLiked = !liked[list.id];
    setLiked((prev) => ({ ...prev, [list.id]: nowLiked }));

    const nextLists = lists.map((item) =>
      item.id === list.id
        ? { ...item, likes: item.likes + (nowLiked ? 1 : -1) }
        : item
    );

    await persistLists(nextLists);
  };

  const createList = async () => {
    if (!currentUser) {
      toast.error("No active user profile available.");
      return;
    }

    if (!newName.trim()) {
      toast.error("List name is required.");
      return;
    }

    if (newVisibility === "group" && !newGroupId) {
      toast.error("Please select a group for group visibility.");
      return;
    }

    const nextList: SharedList = {
      id: `list-${Date.now()}`,
      name: newName.trim(),
      description: newDescription.trim() || "No description yet.",
      visibility: newVisibility,
      owner: currentUser,
      collaborators: [],
      movies: [],
      likes: 0,
      comments: 0,
      createdAt: "Just now",
      groupId: newVisibility === "group" ? newGroupId : undefined,
    };

    await persistLists([nextList, ...lists]);

    setNewName("");
    setNewDescription("");
    setNewVisibility("public");
    setNewGroupId("");
    setOpenCreate(false);

    toast.success("Shared list created");
  };

  const mine = lists.filter((list) => list.owner.id === currentUser?.id);
  const publicLists = lists.filter((list) => list.visibility === "public");
  const groupLists = lists.filter((list) => list.visibility === "group");

  return (
    <div className="container py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground">Shared Lists</h1>
          <p className="text-sm text-muted-foreground mt-1">Build and share curated movie collections with friends and groups.</p>
        </div>

        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2"><ListPlus className="h-4 w-4" /> New List</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Shared List</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="List name" />
              <Textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder="Description" rows={3} />
              <Select value={newVisibility} onValueChange={(value: "public" | "private" | "group") => setNewVisibility(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>

              {newVisibility === "group" && (
                <Select value={newGroupId} onValueChange={setNewGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpenCreate(false)}><X className="h-4 w-4 mr-1" /> Cancel</Button>
                <Button onClick={createList}><Check className="h-4 w-4 mr-1" /> Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="public" className="space-y-6">
        <TabsList>
          <TabsTrigger value="public">Public</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="mine">Mine</TabsTrigger>
        </TabsList>

        <TabsContent value="public">
          <ListGrid
            lists={publicLists}
            groups={groups}
            liked={liked}
            onLike={toggleLike}
            onDelete={removeList}
            showDelete={false}
          />
        </TabsContent>

        <TabsContent value="groups">
          <ListGrid
            lists={groupLists}
            groups={groups}
            liked={liked}
            onLike={toggleLike}
            onDelete={removeList}
            showDelete={false}
          />
        </TabsContent>

        <TabsContent value="mine">
          <ListGrid
            lists={mine}
            groups={groups}
            liked={liked}
            onLike={toggleLike}
            onDelete={removeList}
            showDelete={true}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ListGrid({
  lists,
  groups,
  liked,
  onLike,
  onDelete,
  showDelete,
}: {
  lists: SharedList[];
  groups: Group[];
  liked: Record<string, boolean>;
  onLike: (list: SharedList) => void;
  onDelete: (id: string) => void;
  showDelete: boolean;
}) {
  if (lists.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
        No lists here yet.
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      <AnimatePresence>
        {lists.map((list, index) => {
          const config = visibilityConfig[list.visibility];
          const VisibilityIcon = config.icon;
          const group = list.groupId ? groups.find((item) => item.id === list.groupId) : null;

          return (
            <motion.article
              key={list.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ delay: index * 0.03 }}
              className="rounded-xl bg-card p-4 card-shadow hover:card-shadow-hover transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <VisibilityIcon className={`h-3.5 w-3.5 ${config.color}`} />
                    {config.label}
                    {group && <Badge variant="outline">{group.name}</Badge>}
                  </div>
                  <h3 className="font-semibold text-foreground mt-1">{list.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{list.description}</p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <UserPlus className="h-4 w-4 mr-2" /> Invite collaborator
                    </DropdownMenuItem>
                    {showDelete && (
                      <DropdownMenuItem onClick={() => onDelete(list.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete list
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={list.owner.avatar} />
                  <AvatarFallback>{list.owner.displayName.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <p className="text-xs text-muted-foreground">by {list.owner.displayName}</p>
              </div>

              <div className="grid grid-cols-5 gap-2 mt-4">
                {list.movies.slice(0, 5).map((movie) => (
                  <Link key={movie.id} href={`/movie/${movie.id}`} className="block rounded-md overflow-hidden bg-muted">
                    <img src={movie.poster} alt={movie.title} className="w-full h-20 object-cover" />
                  </Link>
                ))}
                {list.movies.length === 0 && (
                  <div className="col-span-5 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground flex items-center gap-2">
                    <Film className="h-3.5 w-3.5" /> No movies yet
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <button onClick={() => onLike(list)} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <Heart className={`h-3.5 w-3.5 ${liked[list.id] ? "fill-primary text-primary" : ""}`} />
                    {list.likes}
                  </button>
                  <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {list.comments}</span>
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {list.collaborators.length + 1}</span>
                </div>
                <span>{list.createdAt}</span>
              </div>

              <div className="mt-3 flex justify-end">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add movie
                </Button>
              </div>
            </motion.article>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
