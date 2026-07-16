import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  buildLogContext,
  serializeEvent,
} from "@/app/groups/lib/api-utils";
import {
  apiNotFound,
  apiForbidden,
  apiValidationError,
  apiInternalError,
} from "@/app/groups/lib/api-response";
import { updateEventRsvpSchema } from "@/app/groups/lib/api-schemas";
import { publishGroupEvent } from "@/lib/group-events";

export const runtime = "nodejs";

/**
 * Updates a user's RSVP state for a group event.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string; eventId: string }> }
) {
  const { groupId, eventId } = await params;
  const logCtx = buildLogContext(request);

  try {
    const user = await requireAuth(request);
    logCtx.userId = user.id;

    // RSVP changes are only allowed for existing group members.
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user.id } },
    });

    if (!member) {
      return apiForbidden("Not a member of this group");
    }

    const body = await request.json().catch(() => ({}));
    const parseResult = updateEventRsvpSchema.safeParse(body);

    if (!parseResult.success) {
      return apiValidationError("Invalid request body", {
        fields: parseResult.error.flatten().fieldErrors,
      });
    }

    const { rsvpStatus, opId } = parseResult.data;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { groupId: true },
    });

    if (!event || event.groupId !== groupId) {
      return apiNotFound("Event");
    }

    await prisma.eventAttendee.upsert({
      where: { eventId_userId: { eventId, userId: user.id } },
      update: {
        rsvpStatus,
        rsvpAt: new Date(),
      },
      create: {
        eventId,
        userId: user.id,
        rsvpStatus,
        rsvpAt: new Date(),
      },
    });

    const updatedEvent = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        groupId: true,
        createdBy: true,
        title: true,
        description: true,
        startDate: true,
        startTime: true,
        location: true,
        creator: {
          select: { id: true, displayName: true, username: true, avatar: true },
        },
        attendees: {
          select: {
            id: true,
            rsvpStatus: true,
            rsvpAt: true,
            user: {
              select: { id: true, displayName: true, username: true, avatar: true },
            },
          },
        },
      },
    });

    const headerOpId = request.headers.get("x-op-id");
    const eventOpId = opId ?? headerOpId ?? undefined;

    publishGroupEvent(
      groupId,
      {
        type: "group-updated",
        action: "updated",
        eventId,
        event: updatedEvent ? serializeEvent(updatedEvent) : undefined,
      },
      eventOpId
    );

    return NextResponse.json({ value: updatedEvent ? serializeEvent(updatedEvent) : null });
  } catch (err) {
    console.error("/api/groups/[groupId]/events/[eventId]/rsvp POST error:", err);
    return apiInternalError();
  }
}
