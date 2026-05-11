import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAppData } from "@/lib/app-data";
import type { UserProfile } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: { id: true, name: true, email: true, image: true },
  });

  const profiles = (await getAppData<Record<string, Partial<UserProfile>>>("users/profiles", {})) ?? {};

  const value = users.map((user) => {
    const profile = profiles[user.id] ?? {};
    const displayName = profile.displayName || user.name || user.email?.split("@")[0] || "Movie Lover";
    const username = profile.username || displayName.toLowerCase().replace(/\s+/g, "_");

    return {
      id: user.id,
      email: user.email || undefined,
      username,
      displayName,
      avatar: profile.avatar || user.image || "",
      bio: profile.bio || "",
      followers: profile.followers ?? 0,
      following: profile.following ?? 0,
      reviewCount: profile.reviewCount ?? 0,
      watchlistCount: profile.watchlistCount ?? 0,
      favoriteMovies: profile.favoriteMovies ?? [],
    } satisfies UserProfile;
  });

  return NextResponse.json({ value });
}
