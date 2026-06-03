import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
import { fetchGroupDetail } from "@/lib/group-discussions";
import { publishGroupEvent, publishNotificationEvent } from "@/lib/group-events";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const logCtx = buildLogContext(_request);

  try {
    const currentUser = await getCurrentUser();
    const group = await fetchGroupDetail(groupId, currentUser);

    if (!group) {
      return apiNotFound("Group");
    }

    return NextResponse.json({ value: group.discussions });
  } catch (err) {
    console.error("/api/groups/[groupId]/discussions GET error:", err);
    return apiInternalError();
  }
}

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

    const groupMembers = await prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });

    const otherMembers = groupMembers.filter((member) => member.userId !== currentUser.id);
    if (otherMembers.length > 0) {
      const notificationData = otherMembers.map((member) => ({
        recipientId: member.userId,
        actorId: currentUser.id,
        type: "discussion_created" as const,
        groupId,
        discussionId: discussion.id,
        message: `started a discussion in your group: "${title}"`,
      }));

      const createdNotifications = await prisma.notification.createMany({
        data: notificationData,
      });

      if (createdNotifications.count > 0) {
        for (const member of otherMembers) {
          publishNotificationEvent(`${groupId}-${member.userId}`);
        }
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
