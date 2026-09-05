import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  buildLogContext,
} from "@/app/groups/lib/api-utils";
import {
  apiNotFound,
  apiValidationError,
  apiInternalError,
} from "@/app/groups/lib/api-response";
import { addDiscussionReply } from "@/app/groups/lib/discussions";
import { publishGroupEvent } from "@/app/groups/lib/events";
import { enqueueNotification } from "@/lib/queues/notifications";

export const runtime = "nodejs";

/**
 * Adds a reply to a discussion and notifies the discussion author.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string; discussionId: string }> }
) {
  const { groupId, discussionId } = await params;
  const logCtx = buildLogContext(request);

  try {
    const currentUser = await requireAuth(request);
    logCtx.userId = currentUser.id;
    const actorName = currentUser.displayName?.trim();

    const body = await request.json().catch(() => ({}));
    const opId = typeof body?.opId === "string" ? body.opId : request.headers.get("x-op-id") ?? undefined;
    const replyBody = typeof body?.body === "string" ? body.body.trim() : "";

    if (!replyBody) {
      return apiValidationError("Reply body is required", {
        body: ["Reply body is required."],
      });
    }

    const discussion = await prisma.groupDiscussion.findFirst({
      where: { id: discussionId, groupId },
    });

    if (!discussion) {
      return apiNotFound("Discussion");
    }

    if (discussion.authorId !== currentUser.id && actorName) {
      await enqueueNotification({
        recipientId: discussion.authorId,
        actorId: currentUser.id,
        type: "discussion_reply",
        groupId,
        discussionId,
        message: `replied to your discussion`,
      });
    }

    // The shared helper updates both the reply count and the discussion payload in one step.
    const result = await addDiscussionReply(groupId, discussionId, replyBody);

    if ("error" in result) {
      return apiNotFound("Discussion");
    }

    publishGroupEvent(groupId, { type: "group-updated", discussion: result.value ?? undefined }, opId);
    return NextResponse.json({ value: result.value, opId }, { status: 201 });
  } catch (err) {
    console.error("/api/groups/[groupId]/discussions/[discussionId]/replies POST error:", err);
    return apiInternalError();
  }
}