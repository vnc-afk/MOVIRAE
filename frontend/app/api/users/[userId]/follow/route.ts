import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/features/auth/config";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return null;
  }

  return prisma.user.findUnique({ where: { email } });
}

async function getFollowCounts(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      _count: {
        select: {
          followers: true,
          followings: true,
        },
      },
    },
  });
}

export async function POST(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;

    if (userId === currentUser.id) {
      return NextResponse.json({ error: "You cannot follow yourself." }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existingFollow = await prisma.userFollow.findFirst({
      where: {
        followerId: currentUser.id,
        followingId: userId,
      },
      select: { id: true },
    });

    if (!existingFollow) {
      await prisma.$transaction([
        prisma.userFollow.create({
          data: {
            followerId: currentUser.id,
            followingId: userId,
          },
        }),
        prisma.notification.create({
          data: {
            recipientId: userId,
            actorId: currentUser.id,
            type: "follow",
            message: "started following you.",
          },
        }),
      ]);
    }

    const [targetCounts, currentCounts] = await Promise.all([
      getFollowCounts(userId),
      getFollowCounts(currentUser.id),
    ]);

    return NextResponse.json({
      value: {
        isFollowing: true,
        followers: targetCounts?._count.followers ?? 0,
        following: currentCounts?._count.followings ?? 0,
      },
    });
  } catch (error) {
    console.error("/api/users/[userId]/follow POST error:", error);
    return NextResponse.json({ error: "Failed to follow user" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;

    if (userId === currentUser.id) {
      return NextResponse.json({ error: "You cannot unfollow yourself." }, { status: 400 });
    }

    await prisma.userFollow.deleteMany({
      where: {
        followerId: currentUser.id,
        followingId: userId,
      },
    });

    const [targetCounts, currentCounts] = await Promise.all([
      getFollowCounts(userId),
      getFollowCounts(currentUser.id),
    ]);

    return NextResponse.json({
      value: {
        isFollowing: false,
        followers: targetCounts?._count.followers ?? 0,
        following: currentCounts?._count.followings ?? 0,
      },
    });
  } catch (error) {
    console.error("/api/users/[userId]/follow DELETE error:", error);
    return NextResponse.json({ error: "Failed to unfollow user" }, { status: 500 });
  }
}