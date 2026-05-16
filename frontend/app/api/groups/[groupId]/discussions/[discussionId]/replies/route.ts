import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { addDiscussionReply } from "@/lib/group-discussions";
import { publishGroupEvent, publishNotificationEvent } from "@/lib/group-events";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function normalizeReplyItems(replyItems: any): any[] {
  if (!replyItems) return [];
  if (typeof replyItems === "string") return [];
  if (Array.isArray(replyItems)) return replyItems;
  return [];
}

export async function POST(request: Request, { params }: { params: Promise<{ groupId: string; discussionId: string }> }) {
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

  const body = await request.json().catch(() => null);
  const opId = typeof body?.opId === "string" ? body.opId : request.headers.get("x-op-id") ?? undefined;
  const replyBody = typeof body?.body === "string" ? body.body.trim() : "";

  if (!replyBody) {
    return NextResponse.json({ error: "Reply body is required." }, { status: 400 });
  }

  const discussion = await prisma.groupDiscussion.findFirst({
    where: { id: discussionId, groupId },
  });

  if (!discussion) {
    return NextResponse.json({ error: "Discussion not found." }, { status: 404 });
  }

  // Create notification if replying to someone else's discussion
  if (discussion.authorId !== currentUser.id && actorName) {
    const notification = await prisma.notification.create({
      data: {
        recipientId: discussion.authorId,
        actorId: currentUser.id,
        type: "discussion_reply",
        groupId: groupId,
        discussionId: discussionId,
        message: `replied to your discussion`,
      },
    });
    publishNotificationEvent(notification.id);
  }

  const result = await addDiscussionReply(groupId, discussionId, replyBody);

  if ("error" in result) {
    return NextResponse.json({ error: result.error === "unauthorized" ? "Unauthorized" : "Discussion not found." }, { status: result.error === "unauthorized" ? 401 : 404 });
  }

  publishGroupEvent(groupId, { type: "group-updated", group: result.value ?? undefined }, opId);
  return NextResponse.json({ ...result, opId });
}