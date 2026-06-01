import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { fetchGroupDetail } from "@/lib/group-discussions";
import { publishGroupEvent, publishNotificationEvent } from "@/lib/group-events";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
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
  const actorName = currentUser?.displayName?.trim();

  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const opId = typeof body?.opId === "string" ? body.opId : request.headers.get("x-op-id") ?? undefined;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const discussionBody = typeof body?.body === "string" ? body.body.trim() : "";
  const movieId = typeof body?.movieId === "string" ? body.movieId : undefined;

  if (!title || !discussionBody) {
    return NextResponse.json({ error: "Title and body are required." }, { status: 400 });
  }

  // Verify group exists
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return NextResponse.json({ error: "Group not found." }, { status: 404 });
  }

  // Create discussion
  const discussion = await prisma.groupDiscussion.create({
    data: {
      groupId,
      authorId: currentUser.id,
      title,
      body: discussionBody,
      movieId,
      likes: 0,
      replies: 0,
      likedBy: [],
      replyItems: [],
    },
  });

  // Create notifications for other group members
  const groupMembers = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });

  const otherMembers = groupMembers.filter((m) => m.userId !== currentUser.id);
  if (otherMembers.length > 0 && actorName) {
    const notificationData = otherMembers.map((member) => ({
      recipientId: member.userId,
      actorId: currentUser.id,
      type: "discussion_created" as const,
      groupId: groupId,
      discussionId: discussion.id,
      message: `started a discussion in your group: "${title}"`,
    }));
    
    const createdNotifications = await prisma.notification.createMany({
      data: notificationData,
    });

    // Publish notification events
    if (createdNotifications.count > 0) {
      for (const member of otherMembers) {
        publishNotificationEvent(`${groupId}-${member.userId}`);
      }
    }
  }

  const result = await fetchGroupDetail(groupId, currentUser);
  publishGroupEvent(groupId, { type: "group-updated", group: result ?? undefined }, opId);
  return NextResponse.json({ value: result, opId });
}