"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Users, UserPlus, Heart } from "lucide-react";

import { FollowButton } from "@/components/FollowButton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";
import { queryKeys } from "@/lib/queryKeys";
import type { UserProfile } from "@/lib/types";

type PublicProfileSnapshot = {
  profile: UserProfile | null;
  followers: UserProfile[];
  following: UserProfile[];
};

function UserList({ title, users }: { title: string; users: UserProfile[] }) {
  if (users.length === 0) {
    return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No {title.toLowerCase()} yet.</div>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {users.map((user) => (
        <div key={user.id} className="flex items-center gap-3 rounded-xl bg-card p-4 card-shadow">
          {user.avatar ? <img src={user.avatar} alt={user.displayName} className="h-12 w-12 rounded-full bg-muted" /> : <div className="h-12 w-12 rounded-full bg-muted" />}
          <div className="min-w-0 flex-1">
            <Link href={`/profile/${user.id}`} className="block truncate text-sm font-medium text-foreground hover:text-primary transition-colors">
              {user.displayName}
            </Link>
            <p className="truncate text-[11px] text-muted-foreground">@{user.username}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {user.followers.toLocaleString()} followers · {user.following.toLocaleString()} following
            </p>
          </div>
          <FollowButton userId={user.id} initialFollowing={Boolean(user.isFollowing)} />
        </div>
      ))}
    </div>
  );
}

export default function PublicProfilePage() {
  const params = useParams<{ userId: string }>();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const { data: session } = useSession();
  const profileQuery = usePrefetchAwareQuery<PublicProfileSnapshot>({
    queryKey: queryKeys.profile.detail(userId),
    queryFn: async () => {
      const [profileResponse, followersResponse, followingResponse] = await Promise.all([
        fetch(`/api/users/${userId}`).then((response) => response.json()),
        fetch(`/api/users/${userId}/followers`).then((response) => response.json()),
        fetch(`/api/users/${userId}/following`).then((response) => response.json()),
      ]);

      return {
        profile: profileResponse.value ?? null,
        followers: Array.isArray(followersResponse.value) ? followersResponse.value : [],
        following: Array.isArray(followingResponse.value) ? followingResponse.value : [],
      };
    },
    enabled: Boolean(userId),
  });

  const snapshot = profileQuery.data ?? { profile: null, followers: [], following: [] };
  const profile = snapshot.profile;
  const followers = snapshot.followers;
  const following = snapshot.following;

  if (profileQuery.isPending) {
    return <div className="container py-20 text-center text-sm text-muted-foreground">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="container py-20 text-center text-sm text-muted-foreground">Profile not found.</div>;
  }

  const showFollowButton = profile.email ? profile.email !== session?.user?.email : true;

  return (
    <div className="pb-20 md:pb-0">
      <div className="cinema-gradient py-12">
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 md:flex-row md:items-start">
            {profile.avatar ? <img src={profile.avatar} alt={profile.displayName} className="h-24 w-24 rounded-full border-4 border-primary bg-muted" /> : <div className="h-24 w-24 rounded-full border-4 border-primary bg-muted" />}
            <div className="text-center md:text-left">
              <h1 className="font-display text-2xl font-bold text-primary-foreground">{profile.displayName}</h1>
              <p className="text-sm text-primary-foreground/60">@{profile.username}</p>
              <p className="mt-2 max-w-md text-sm text-primary-foreground/80">{profile.bio || ""}</p>
              <div className="mt-4 flex items-center justify-center gap-6 md:justify-start">
                <div className="text-center">
                  <span className="text-lg font-bold text-primary-foreground">{profile.followers.toLocaleString()}</span>
                  <p className="text-xs text-primary-foreground/50">Followers</p>
                </div>
                <div className="text-center">
                  <span className="text-lg font-bold text-primary-foreground">{profile.following.toLocaleString()}</span>
                  <p className="text-xs text-primary-foreground/50">Following</p>
                </div>
                <div className="text-center">
                  <span className="text-lg font-bold text-primary-foreground">{profile.reviewCount.toLocaleString()}</span>
                  <p className="text-xs text-primary-foreground/50">Reviews</p>
                </div>
              </div>
            </div>
            <div className="md:ml-auto flex flex-col gap-2">
              {showFollowButton ? <FollowButton userId={profile.id} initialFollowing={Boolean(profile.isFollowing)} className="w-full md:w-auto" /> : null}
              {showFollowButton ? (
                <button
                  onClick={() => window.location.assign(`/notifications?user=${profile.id}`)}
                  className="rounded-full bg-primary/10 px-4 py-2 text-sm text-primary hover:bg-primary/20"
                >
                  Message
                </button>
              ) : null}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mt-8">
        <Tabs defaultValue="followers" className="w-full">
          <TabsList className="mb-6 bg-secondary">
            <TabsTrigger value="followers" id="followers" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Followers</TabsTrigger>
            <TabsTrigger value="following" id="following" className="gap-1.5"><UserPlus className="h-3.5 w-3.5" /> Following</TabsTrigger>
            <TabsTrigger value="stats" className="gap-1.5"><Heart className="h-3.5 w-3.5" /> Stats</TabsTrigger>
          </TabsList>

          <TabsContent value="followers">
            <UserList title="Followers" users={followers} />
          </TabsContent>

          <TabsContent value="following">
            <UserList title="Following" users={following} />
          </TabsContent>

          <TabsContent value="stats">
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              This profile currently shows follower and following relationships only.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
