import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { subscribeToGroupEvents, publishGroupEvent } from "@/lib/group-events";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { GroupEvent } from "@/lib/group-events";
import { isGroupAdmin } from "@/lib/group-utils";

export const runtime = "nodejs";

function serializeEventDate(startDate: Date) {
  return startDate.toISOString().slice(0, 10);
}

function serializeEvent<T extends { startDate: Date }>(event: T) {
  return {
    ...event,
    startDate: serializeEventDate(event.startDate),
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  
  // Check if this is a data request (query param) or SSE connection
  const url = new URL(request.url);
  if (url.searchParams.has("data")) {
    // Return events data as JSON
    try {
      const events = await prisma.event.findMany({
        where: { groupId },
        include: {
          creator: {
            select: { id: true, displayName: true, username: true, avatar: true },
          },
          attendees: {
            include: {
              user: {
                select: { id: true, displayName: true, username: true, avatar: true },
              },
            },
          },
        },
        orderBy: { startDate: "asc" },
      });

      return NextResponse.json({ value: events.map(serializeEvent) });
    } catch (err) {
      console.error("/api/groups/[groupId]/events GET data error:", err);
      return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
    }
  }

  // Otherwise, return SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
        const send = (event: GroupEvent) => {
        controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
      };

      const unsubscribe = subscribeToGroupEvents(groupId, send);
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ groupId, timestamp: new Date().toISOString() })}\n\n`));

      const heartbeatId = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 30000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatId);
        unsubscribe();
        controller.close();
      });
    },
    cancel() {
      // handled via abort listener
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, displayName: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if user is admin of the group
  const isAdmin = await isGroupAdmin(user.id, groupId);
  if (!isAdmin) {
    return NextResponse.json({ error: "Only group admins can create events" }, { status: 403 });
  }

  // Validate request body
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const startDate = typeof body?.startDate === "string" ? body.startDate : null;
  const startTime = typeof body?.startTime === "string" ? body.startTime : "";
  const location = typeof body?.location === "string" ? body.location.trim() : null;

  if (!title || !startDate || !startTime) {
    return NextResponse.json(
      { error: "Title, start date, and start time are required" },
      { status: 400 }
    );
  }

  if (title.length > 100) {
    return NextResponse.json({ error: "Title must be 100 characters or less" }, { status: 400 });
  }

  if (description && description.length > 500) {
    return NextResponse.json({ error: "Description must be 500 characters or less" }, { status: 400 });
  }

  if (location && location.length > 150) {
    return NextResponse.json({ error: "Location must be 150 characters or less" }, { status: 400 });
  }

  if (Number.isNaN(new Date(startDate).getTime())) {
    return NextResponse.json({ error: "Start date must be a valid date" }, { status: 400 });
  }

  // Validate startDate is not in the past
  const eventDate = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  eventDate.setHours(0, 0, 0, 0);

  if (eventDate < today) {
    return NextResponse.json({ error: "Event date cannot be in the past" }, { status: 400 });
  }

  try {
    // Create event
    const event = await prisma.event.create({
      data: {
        groupId,
        createdBy: user.id,
        title,
        description: description || null,
        startDate: new Date(startDate),
        startTime,
        location: location || null,
      },
      include: {
        creator: {
          select: { id: true, displayName: true, username: true, avatar: true },
        },
        attendees: {
          include: {
            user: {
              select: { id: true, displayName: true, username: true, avatar: true },
            },
          },
        },
      },
    });

    // Create notifications for other group members
    const groupMembers = await prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });

    const otherMembers = groupMembers.filter((m) => m.userId !== user.id);
    const actorName = user.displayName?.trim();
    if (otherMembers.length > 0 && actorName) {
      await prisma.notification.createMany({
        data: otherMembers.map((member) => ({
          recipientId: member.userId,
          actorId: user.id,
          type: "event_created" as const,
          groupId: groupId,
          eventId: event.id,
          message: `created a new event: "${title}"`,
        })),
      });
    }

    const headerOpId = request.headers.get("x-op-id");
    const opId = typeof body?.opId === "string" ? body.opId : headerOpId ?? undefined;

    publishGroupEvent(groupId, { type: "group-updated", event, eventId: event.id, action: "created" }, opId);
    return NextResponse.json(serializeEvent(event), { status: 201 });
  } catch (err) {
    console.error("/api/groups/[groupId]/events POST error:", err);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
