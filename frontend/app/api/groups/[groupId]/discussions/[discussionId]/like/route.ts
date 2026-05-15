import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { publishGroupEvent, publishNotificationEvent } from "@/lib/group-events";
import { toggleDiscussionLike } from "@/lib/group-discussions";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function normalizeLikedBy(likedBy: any): string[] {
  if (!likedBy) return [];
  if (typeof likedBy === "string") return [];
  if (Array.isArray(likedBy)) return likedBy;
  return [];
}

export async function POST(_request: Request, { params }: { params: Promise<{ groupId: string; discussionId: string }> }) {
  const { groupId, discussionId } = await params;
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, displayName: true, email: true },
  });
  const actorName = currentUser?.displayName?.trim();

  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const discussion = await prisma.groupDiscussion.findFirst({
    where: { id: discussionId, groupId },
  });

  if (!discussion) {
    return NextResponse.json({ error: "Discussion not found." }, { status: 404 });
  }

  const likedBy = normalizeLikedBy(discussion.likedBy);
  const isNewLike = !likedBy.includes(currentUser.id);
  const nextLikedBy = isNewLike
    ? [...likedBy, currentUser.id]
    : likedBy.filter((userId) => userId !== currentUser.id);

  await prisma.groupDiscussion.update({
    where: { id: discussionId },
    data: {
      likes: nextLikedBy.length,
      likedBy: nextLikedBy,
    },
  });

  // Create notification if liking someone else's discussion
  if (isNewLike && discussion.authorId !== currentUser.id && actorName) {
    // Check for duplicate notification within 5 minutes
    const recentNotification = await prisma.notification.findFirst({
      where: {
        recipientId: discussion.authorId,
        actorId: currentUser.id,
        type: "discussion_like",
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });

    if (!recentNotification) {
      const notification = await prisma.notification.create({
        data: {
          recipientId: discussion.authorId,
          actorId: currentUser.id,
          type: "discussion_like",
          groupId: groupId,
          discussionId: discussionId,
          message: `liked your discussion`,
        },
      });
      publishNotificationEvent(notification.id);
    }
  }

  const result = await toggleDiscussionLike(groupId, discussionId);
  publishGroupEvent(groupId, { type: "group-updated" });
  return NextResponse.json(result);
}