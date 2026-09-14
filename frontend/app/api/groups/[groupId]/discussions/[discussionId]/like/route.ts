import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  buildLogContext,
} from "@/app/groups/lib/api-utils";
import {
  apiSuccess,
  apiNotFound,
  apiInternalError,
} from "@/app/groups/lib/api-response";
import { publishGroupEvent } from "@/app/groups/lib/events";
import { enqueueNotification } from "@/lib/queues/notifications";
import { toggleDiscussionLike } from "@/services/groups/discussions.server";

export const runtime = "nodejs";

/**
 * Toggles a like on a discussion and publishes the updated state to the group stream.
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

    const discussion = await prisma.groupDiscussion.findFirst({
      where: { id: discussionId, groupId },
    });

    if (!discussion) {
      return apiNotFound("Discussion");
    }

    // Check whether this user already liked the discussion before creating a new record.
    const existingLike = await prisma.groupDiscussionLike.findUnique({
      where: { discussionId_userId: { discussionId, userId: currentUser.id } },
    });
    const isNewLike = !existingLike;
    const actorName = currentUser.displayName?.trim();

    if (isNewLike && discussion.authorId !== currentUser.id && actorName) {
      const recentNotification = await prisma.notification.findFirst({
        where: {
          recipientId: discussion.authorId,
          actorId: currentUser.id,
          type: "discussion_like",
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
      });

      if (!recentNotification) {
        await enqueueNotification({
          recipientId: discussion.authorId,
          actorId: currentUser.id,
          type: "discussion_like",
          groupId,
          discussionId,
          message: `liked your discussion`,
        });
      }
    }

    const body = await request.json().catch(() => null);
    const opId = typeof body?.opId === "string" ? body.opId : request.headers.get("x-op-id") ?? undefined;

    const result = await toggleDiscussionLike(groupId, discussionId);

    if ("error" in result) {
      return apiNotFound("Discussion");
    }

    publishGroupEvent(groupId, { type: "group-updated", discussion: result.value ?? undefined }, opId);
    return apiSuccess({ value: result.value, opId });
  } catch (err) {
    console.error("/api/groups/[groupId]/discussions/[discussionId]/like POST error:", err);
    return apiInternalError();
  }
}