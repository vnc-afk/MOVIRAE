import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishGroupEvent } from "@/lib/group-events";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string; eventId: string }> }
) {
  const { groupId, eventId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Validate that user is a member of the group
  const member = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: { groupId, userId: user.id },
    },
  });

  if (!member) {
    return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const rsvpStatus = typeof body?.rsvpStatus === "string" ? body.rsvpStatus.toLowerCase() : "pending";

  // Validate RSVP status
  if (!["yes", "no", "maybe", "pending"].includes(rsvpStatus)) {
    return NextResponse.json(
      { error: "RSVP status must be one of: yes, no, maybe, pending" },
      { status: 400 }
    );
  }

  try {
    // Verify event exists and belongs to the group
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { groupId: true },
    });

    if (!event || event.groupId !== groupId) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Upsert attendee record
    const attendee = await prisma.eventAttendee.upsert({
      where: {
        eventId_userId: { eventId, userId: user.id },
      },
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
      include: {
        user: {
          select: { id: true, displayName: true, username: true, avatar: true },
        },
      },
    });

    publishGroupEvent(groupId, { type: "group-updated" });
    return NextResponse.json(attendee);
  } catch (err) {
    console.error("/api/groups/[groupId]/events/[eventId]/rsvp POST error:", err);
    return NextResponse.json({ error: "Failed to update RSVP" }, { status: 500 });
  }
}
