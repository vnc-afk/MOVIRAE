import type { UserProfile } from "@/lib/types";
import type { User } from "@prisma/client";

export type RawUserProfile = Pick<
  User,
  | "id"
  | "email"
  | "name"
  | "username"
  | "displayName"
  | "avatar"
  | "image"
  | "bio"
>;

export function buildUserProfile(user: RawUserProfile | null | undefined): UserProfile | null {
  if (!user) return null;

  const displayName = user.displayName || user.name || user.email?.split("@")[0] || "Movie Lover";
  const username = user.username || displayName.toLowerCase().replace(/\s+/g, "_");

  return {
    id: user.id ?? "",
    email: user.email || undefined,
    username,
    displayName,
    avatar: user.avatar || user.image || "",
    bio: user.bio || "",
    followers: 0,
    following: 0,
    reviewCount: 0,
    watchlistCount: 0,
    favoriteMovies: [],
  };
}

export function normalizeLabel(value: string | null | undefined) {
  if (!value) return "";
  return value.trim();
}

export function isKnownValue(value: string | null | undefined) {
  const normalized = normalizeLabel(value);
  return normalized !== "" && normalized.toLowerCase() !== "unknown";
}

export function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = normalizeLabel(getKey(item));
    if (!isKnownValue(key)) return acc;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

export function sortBreakdown(entries: Array<{ count: number; [key: string]: unknown }>) {
  return entries.sort((a, b) => b.count - a.count);
}
