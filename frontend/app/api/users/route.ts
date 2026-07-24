import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import type { UserProfile } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      username: true,
      displayName: true,
      avatar: true,
      bio: true,
      favorites: { select: { tmdbId: true } },
      _count: {
        select: {
          followers: true,
          followings: true,
          reviews: true,
          watchlist: true,
        },
      },
    },
  });

  const value = users.map((user) => {
    const displayName = user.displayName || user.name || user.email?.split("@")[0] || "Movie Lover";
    const username = user.username || displayName.toLowerCase().replace(/\s+/g, "_");

    return {
      id: user.id,
      email: user.email || undefined,
      username,
      displayName,
      avatar: user.avatar || user.image || "",
      bio: user.bio || "",
      followers: user._count.followers,
      following: user._count.followings,
      reviewCount: user._count.reviews,
      watchlistCount: user._count.watchlist,
      favoriteMovies: user.favorites.map((favorite) => favorite.tmdbId),
    } satisfies UserProfile;
  });

  return NextResponse.json({ value });
}
