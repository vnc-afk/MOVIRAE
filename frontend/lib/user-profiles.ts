import type { UserProfile } from "@/lib/types";

type ProfileUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  username?: string | null;
  displayName?: string | null;
  avatar?: string | null;
  image?: string | null;
  bio?: string | null;
  _count?: {
    followers?: number;
    followings?: number;
    reviews?: number;
    watchlist?: number;
  };
};

export function buildUserProfile(user: ProfileUser | null | undefined, isFollowing = false) {
  if (!user) return null;

  const displayName = user.displayName || user.name || user.email?.split("@")[0] || "Movie Lover";
  const username = user.username || displayName.toLowerCase().replace(/\s+/g, "_");

  return {
    id: user.id,
    email: user.email || undefined,
    username,
    displayName,
    avatar: user.avatar || user.image || "",
    bio: user.bio || "",
    followers: user._count?.followers ?? 0,
    following: user._count?.followings ?? 0,
    reviewCount: user._count?.reviews ?? 0,
    watchlistCount: user._count?.watchlist ?? 0,
    favoriteMovies: [],
    isFollowing,
  } satisfies UserProfile;
}

export function isProfileUser(x: unknown): x is ProfileUser {
  return !!x && typeof x === "object" && typeof (x as any).id === "string";
}
