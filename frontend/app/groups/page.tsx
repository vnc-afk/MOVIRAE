"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Users, Plus, MessageCircle, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Group, UserProfile } from "@/lib/types";

const avatarUrl = (seed: string) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;

type GroupRecord = Group & { joined?: boolean };

async function fetchJsonValue<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`fetchJsonValue: ${url} returned ${response.status}: ${errText}`);
      return null;
    }

    const text = await response.text();
    if (!text.trim()) return null;

    return JSON.parse(text) as T;
  } catch (err) {
    console.error("fetchJsonValue error for", url, err);
    return null;
  }
}

export default function Groups() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    Promise.all([
      fetchJsonValue<{ value: GroupRecord[] }>("/api/data/groups"),
      fetchJsonValue<{ value: UserProfile[] }>("/api/users"),
    ])
      .then(([groupsResponse, usersResponse]) => {
        setGroups(Array.isArray(groupsResponse?.value) ? groupsResponse.value : []);
        setUsers(Array.isArray(usersResponse?.value) ? usersResponse.value : []);
      })
      .catch((error) => console.error("Failed to load groups:", error));
  }, []);

  const currentUser = users[0] ?? null;

  const persistGroups = async (nextGroups: GroupRecord[]) => {
    setGroups(nextGroups);

    const response = await fetch("/api/data/groups", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextGroups),
    });

    if (!response.ok) {
      throw new Error(`Failed to persist groups: ${response.status}`);
    }

    const payload = await response.json();
    const savedGroups = Array.isArray(payload.value) ? payload.value as GroupRecord[] : nextGroups;
    setGroups(savedGroups);
    return savedGroups;
  };

  const applyMembership = (group: GroupRecord, shouldJoin: boolean) => {
    if (!currentUser) return group;

    const alreadyMember = group.members.some((member) => member.id === currentUser.id);
    const members = shouldJoin
      ? alreadyMember
        ? group.members
        : [currentUser, ...group.members]
      : group.members.filter((member) => member.id !== currentUser.id);

    return {
      ...group,
      members,
      memberCount: members.length,
      joined: shouldJoin,
    };
  };

  const handleJoin = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUser) {
      toast.error("Sign in to join a group.");
      return;
    }

    const nextGroups = groups.map((group) =>
      group.id === id ? applyMembership(group, !group.joined) : group
    );
    const savedGroups = await persistGroups(nextGroups);

    const group = savedGroups.find((item) => item.id === id);
    toast.success(group?.joined ? `Joined ${group.name}!` : `Left ${group?.name}`);
  };

  const handleCreate = async () => {
    if (!name.trim() || !description.trim()) {
      toast.error("Add a name and description.");
      return;
    }

    if (!currentUser) {
      toast.error("Sign in to create a group.");
      return;
    }

    const newGroup: GroupRecord = {
      id: `g-${Date.now()}`,
      name,
      description,
      memberCount: 1,
      avatar: avatarUrl(name),
      members: [currentUser],
      sharedList: [],
      joined: true,
    };

    const savedGroups = await persistGroups([newGroup, ...groups]);
    const createdGroup = savedGroups.find((group) => group.id === newGroup.id) ?? savedGroups[0] ?? newGroup;
    setOpen(false);
    setName("");
    setDescription("");
    toast.success(`${createdGroup.name} created!`);
    router.push(`/groups/${createdGroup.id}`);
  };

  return (
    <div className="pb-20 md:pb-0">
      <div className="container py-8 space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-5 w-5 text-primary" />
              <h1 className="font-display text-2xl font-bold text-foreground">Groups & Clubs</h1>
            </div>
            <p className="text-sm text-muted-foreground">Join communities, share watchlists, and discuss films together.</p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Create Group</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a new group</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="g-name">Group name</Label>
                  <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="g-desc">Description</Label>
                  <Textarea id="g-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Group description" rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate}>Create Group</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>

        {groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No groups yet. Create one to get started.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group, i) => (
              <motion.div key={group.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="rounded-xl bg-card p-6 card-shadow hover:card-shadow-hover transition-shadow duration-300">
                <Link href={`/groups/${group.id}`} className="block">
                  <div className="flex items-start gap-4">
                    {group.avatar ? (
                      <img src={group.avatar} alt={group.name} className="h-14 w-14 rounded-xl bg-muted" />
                    ) : (
                      <div className="h-14 w-14 rounded-xl bg-muted" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground hover:text-primary transition-colors">{group.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{group.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {group.memberCount} members</span>
                    <span className="flex items-center gap-1"><Film className="h-3.5 w-3.5" /> {group.sharedList.length} shared films</span>
                  </div>

                  <div className="flex items-center mt-4">
                    <div className="flex -space-x-2">
                      {group.members.slice(0, 3).map((member) => (
                        member.avatar ? (
                          <img key={member.id} src={member.avatar} alt={member.displayName} className="h-7 w-7 rounded-full border-2 border-card bg-muted" />
                        ) : (
                          <div key={member.id} className="h-7 w-7 rounded-full border-2 border-card bg-muted" />
                        )
                      ))}
                    </div>
                    {group.memberCount > 3 && <span className="ml-2 text-xs text-muted-foreground">+{group.memberCount - 3} more</span>}
                  </div>

                  {group.sharedList.length > 0 && (
                    <div className="flex gap-2 mt-4">
                      {group.sharedList.slice(0, 3).map((movie) => (
                        movie.poster ? (
                          <img key={movie.id} src={movie.poster} alt={movie.title} className="h-16 w-11 rounded object-cover poster-shadow" />
                        ) : (
                          <div key={movie.id} className="h-16 w-11 rounded bg-muted poster-shadow" />
                        )
                      ))}
                    </div>
                  )}
                </Link>

                <div className="flex gap-2 mt-5">
                  <Button size="sm" variant={group.joined ? "secondary" : "default"} className="flex-1 gap-1.5" onClick={(e) => handleJoin(group.id, e)}>
                    <Users className="h-3.5 w-3.5" />
                    {group.joined ? "Joined" : "Join"}
                  </Button>
                  <Button size="sm" variant="secondary" className="flex-1 gap-1.5" asChild>
                    <Link href={`/groups/${group.id}`}><MessageCircle className="h-3.5 w-3.5" /> Discuss</Link>
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
