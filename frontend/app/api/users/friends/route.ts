import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildUserProfile } from "@/lib/user-profiles";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({ where: { email } });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const followings = await prisma.userFollow.findMany({ where: { followerId: currentUser.id }, select: { followingId: true } });
    const followers = await prisma.userFollow.findMany({ where: { followingId: currentUser.id }, select: { followerId: true } });

    const followingIds = new Set(followings.map((f: { followingId: string }) => f.followingId));
    const followerIds = new Set(followers.map((f: { followerId: string }) => f.followerId));

    const mutualIds = [...followingIds].filter((id: string) => followerIds.has(id));

    if (mutualIds.length === 0) {
      return NextResponse.json({ value: [] });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: mutualIds } },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        displayName: true,
        avatar: true,
        image: true,
        bio: true,
      },
    });

    const profiles = users.map((u: { id: string; email: string | null; name: string | null; username: string | null; displayName: string | null; avatar: string | null; image: string | null; bio: string | null }) => buildUserProfile(u)).filter(Boolean);

    return NextResponse.json({ value: profiles });
  } catch (error) {
    console.error("/api/users/friends GET error:", error);
    return NextResponse.json({ error: "Failed to fetch friends" }, { status: 500 });
  }
}
