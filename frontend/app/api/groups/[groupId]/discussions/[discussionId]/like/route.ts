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
import { publishGroupEvent, publishNotificationEvent } from "@/lib/group-events";
import { toggleDiscussionLike } from "@/lib/group-discussions";

export const runtime = "nodejs";

function normalizeLikedBy(likedBy: any): string[] {
  if (!likedBy) return [];
  if (typeof likedBy === "string") return [];
  if (Array.isArray(likedBy)) return likedBy;
  return [];
}

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

    const likedBy = normalizeLikedBy(discussion.likedBy);
    const isNewLike = !likedBy.includes(currentUser.id);
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
        const notification = await prisma.notification.create({
          data: {
            recipientId: discussion.authorId,
            actorId: currentUser.id,
            type: "discussion_like",
            groupId,
            discussionId,
            message: `liked your discussion`,
          },
        });
        publishNotificationEvent(notification.id);
      }
    }

    const body = await request.json().catch(() => null);
    const opId = typeof body?.opId === "string" ? body.opId : request.headers.get("x-op-id") ?? undefined;

    const result = await toggleDiscussionLike(groupId, discussionId);
    publishGroupEvent(groupId, { type: "group-updated", group: result.value ?? undefined }, opId);
    return apiSuccess({ ...result, opId });
  } catch (err) {
    console.error("/api/groups/[groupId]/discussions/[discussionId]/like POST error:", err);
    return apiInternalError();
  }
}
