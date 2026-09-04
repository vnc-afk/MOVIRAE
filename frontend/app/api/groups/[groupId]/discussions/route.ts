import { NextResponse } from "next/server";
import {
  getCurrentUser,
  requireAuth,
  buildLogContext,
} from "@/app/groups/lib/api-utils";
import {
  apiNotFound,
  apiValidationError,
  apiInternalError,
} from "@/app/groups/lib/api-response";
import { createDiscussionSchema } from "@/app/groups/lib/api-schemas";
import { fetchGroupDiscussions } from "@/app/groups/lib/discussions";
import { prisma } from "@/lib/prisma";
import { publishGroupEvent } from "@/app/groups/lib/events";
import { publishNotificationEvent } from "@/app/notifications/lib/events";

export const runtime = "nodejs";

/**
 * Returns the discussion feed for a group.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const logCtx = buildLogContext(_request);

  try {
    const currentUser = await getCurrentUser();
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true },
    });

    if (!group) {
      return apiNotFound("Group");
    }

    return NextResponse.json({ value: await fetchGroupDiscussions(groupId, currentUser) });
  } catch (err) {
    console.error("/api/groups/[groupId]/discussions GET error:", err);
    return apiInternalError();
  }
}

/**
 * Creates a discussion and notifies the other group members.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const logCtx = buildLogContext(request);

  try {
    const currentUser = await requireAuth(request);
    logCtx.userId = currentUser.id;

    const body = await request.json().catch(() => ({}));
    const parseResult = createDiscussionSchema.safeParse(body);

    if (!parseResult.success) {
      return apiValidationError("Invalid request body", {
        fields: parseResult.error.flatten().fieldErrors,
      });
    }

    const { title, body: discussionBody, movieId, opId } = parseResult.data;

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true },
    });

    if (!group) {
      return apiNotFound("Group");
    }

    // Persist the discussion first so the server can attach a stable identifier to the event payload.
    const discussion = await prisma.groupDiscussion.create({
      data: {
        groupId,
        authorId: currentUser.id,
        title,
        body: discussionBody,
        movieId,
        likes: 0,
        replies: 0,
      },
    });

    const groupMembers = await prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });

    const otherMembers = groupMembers.filter((member) => member.userId !== currentUser.id);
    if (otherMembers.length > 0) {
      const createdNotifications = await Promise.all(
        otherMembers.map((member) =>
          prisma.notification.create({
            data: {
              recipientId: member.userId,
              actorId: currentUser.id,
              type: "discussion_created",
              groupId,
              discussionId: discussion.id,
              message: `started a discussion in your group: "${title}"`,
            },
          })
        )
      );

      for (const notification of createdNotifications) {
        publishNotificationEvent({
          notificationId: notification.id,
          recipientId: notification.recipientId,
        });
      }
    }

    publishGroupEvent(
      groupId,
      {
        type: "group-updated",
        action: "created",
        eventId: discussion.id,
        event: discussion,
      },
      opId
    );

    return NextResponse.json({ value: discussion, opId }, { status: 201 });
  } catch (err) {
    console.error("/api/groups/[groupId]/discussions POST error:", err);
    return apiInternalError();
  }
}
