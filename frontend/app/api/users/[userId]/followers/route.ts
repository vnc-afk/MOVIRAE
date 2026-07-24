import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildUserProfile } from "@/lib/user-profiles";

export const runtime = "nodejs";

async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) return null;

  return prisma.user.findUnique({ where: { email } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const currentUser = await getCurrentUser();

    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const followers = await prisma.userFollow.findMany({
      where: { followingId: userId },
      select: {
        followerId: true,
        follower: {
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            displayName: true,
            avatar: true,
            image: true,
            bio: true,
            _count: {
              select: {
                followers: true,
                followings: true,
                reviews: true,
                watchlist: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const followingIds = currentUser
      ? new Set(
          (
            await prisma.userFollow.findMany({
              where: {
                followerId: currentUser.id,
                followingId: { in: followers.map((follow) => follow.followerId) },
              },
              select: { followingId: true },
            })
          ).map((follow) => follow.followingId)
        )
      : new Set<string>();

    return NextResponse.json({
      value: followers
        .map((follow) => buildUserProfile(follow.follower, followingIds.has(follow.followerId)))
        .filter(Boolean),
    });
  } catch (error) {
    console.error("/api/users/[userId]/followers GET error:", error);
    return NextResponse.json({ error: "Failed to load followers" }, { status: 500 });
  }
}
