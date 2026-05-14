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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
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

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isFollowing = Boolean(
      currentUser &&
        (await prisma.userFollow.findFirst({
          where: {
            followerId: currentUser.id,
            followingId: userId,
          },
          select: { id: true },
        }))
    );

    return NextResponse.json({
      value: buildUserProfile(user, isFollowing),
    });
  } catch (error) {
    console.error("/api/users/[userId] GET error:", error);
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }
}
