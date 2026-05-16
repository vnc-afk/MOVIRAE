import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishGroupEvent } from "@/lib/group-events";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
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

  try {
    // Verify event exists and get its details
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { groupId: true, createdBy: true },
    });

    if (!event || event.groupId !== groupId) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Check if user is event creator or group creator
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { creatorId: true },
    });

    if (!group || (event.createdBy !== user.id && group.creatorId !== user.id)) {
      return NextResponse.json({ error: "You can only delete your own events" }, { status: 403 });
    }

    // Delete event (cascades to attendees)
    await prisma.event.delete({
      where: { id: eventId },
    });

    const body = await _request.json().catch(() => null);
    const headerOpId = _request.headers.get("x-op-id");
    const opId = typeof body?.opId === "string" ? body.opId : headerOpId ?? undefined;
    publishGroupEvent(groupId, { type: "group-updated", action: "deleted", eventId }, opId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("/api/groups/[groupId]/events/[eventId] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
