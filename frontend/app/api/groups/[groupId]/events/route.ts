/**
 * Example: Refactored /api/groups/[groupId]/events route
 * 
 * This example shows how to use the new utilities:
 * - lib/api-utils.ts - Shared utilities
 * - lib/api-response.ts - Response helpers
 * - lib/api-schemas.ts - Input validation
 * 
 * Copy this pattern to all other endpoints
 */

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  serializeEvent,
  isGroupAdminUser,
  buildLogContext,
  buildPaginationMeta,
} from "@/app/groups/lib/api-utils";
import { NextResponse } from "next/server";
import {
  apiCreated,
  apiNotFound,
  apiForbidden,
  apiValidationError,
  apiInternalError,
} from "@/app/groups/lib/api-response";
import {
  createEventSchema,
  eventsListQuerySchema,
} from "@/app/groups/lib/api-schemas";
import { publishGroupEvent, publishNotificationEvent } from "@/lib/group-events";

const logger = {
  info: console.info,
  warn: console.warn,
  error: console.error,
};

export const runtime = "nodejs";

// ============================================================================
// GET /api/groups/[groupId]/events
// ============================================================================

/**
 * Get all events for a group
 * 
 * @auth Optional - Public readable
 * @param {string} groupId - Group ID
 * @query {number} [page=1] - Page number for pagination
 * @query {number} [limit=20] - Page size for pagination
 * @query {boolean} [upcoming=false] - Show only upcoming events
 * @query {enum} [sort=date] - Sort by "date" or "title"
 * @query {enum} [order=asc] - Order results by "asc" or "desc"
 * 
 * @returns {object[]} Paginated array of events
 * @throws {404} Group not found
 * @throws {500} Internal error
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const logCtx = buildLogContext(request);

  try {
    // Verify group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true },
    });

    if (!group) {
      logger.info("Group not found", { ...logCtx, groupId });
      return apiNotFound("Group");
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryResult = eventsListQuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!queryResult.success) {
      return apiValidationError("Invalid query parameters", {
        fields: queryResult.error.flatten().fieldErrors,
      });
    }

    const { page, limit, upcoming, sort, order } = queryResult.data;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.EventWhereInput = { groupId };

    if (upcoming) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where.startDate = { gte: today };
    }

    // Build order by
    const orderBy: Prisma.EventOrderByWithRelationInput =
      sort === "title" ? { title: order } : { startDate: order };

    // Fetch events
    const [events, total] = await prisma.$transaction([
      prisma.event.findMany({
        where,
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
        orderBy,
        skip,
        take: limit,
      }),
      prisma.event.count({ where }),
    ]);

    const pagination = buildPaginationMeta(page, limit, total);

    logger.info("Events fetched", {
      ...logCtx,
      groupId,
      count: events.length,
      page,
      limit,
      total,
    });

    return NextResponse.json({ value: events.map(serializeEvent), pagination });
  } catch (err) {
    logger.error("Failed to fetch events", {
      ...logCtx,
      groupId,
      error: err instanceof Error ? err.message : String(err),
    });

    return apiInternalError();
  }
}

// ============================================================================
// POST /api/groups/[groupId]/events
// ============================================================================

/**
 * Create a new event for a group
 * 
 * @auth Required - User must be group admin
 * @param {string} groupId - Group ID
 * 
 * @body {string} title - Event title (3-100 chars, required)
 * @body {string} [description] - Event description (0-500 chars)
 * @body {string} startDate - Start date in YYYY-MM-DD format (required, future only)
 * @body {string} startTime - Start time in HH:mm format (required)
 * @body {string} [location] - Event location (0-150 chars)
 * @body {string} [opId] - Optimistic operation ID (for deduplication)
 * 
 * @returns {object} Created event
 * @returns {string} returns.id - Event ID
 * @returns {string} returns.title - Event title
 * @returns {string} returns.startDate - Event start date (YYYY-MM-DD)
 * 
 * @throws {401} Unauthorized - User not authenticated
 * @throws {403} Forbidden - User is not a group admin
 * @throws {404} NotFound - Group not found
 * @throws {400} BadRequest - Invalid input data
 * @throws {500} InternalError - Server error
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const logCtx = buildLogContext(request);

  try {
    // Require authentication
    const user = await requireAuth(request);
    logCtx.userId = user.id;

    // Verify user is group admin
    const isAdmin = await isGroupAdminUser(user.id, groupId);
    if (!isAdmin) {
      logger.warn("Unauthorized group admin attempt", { ...logCtx, groupId });
      return apiForbidden("Only group admins can create events");
    }

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const parseResult = createEventSchema.safeParse(body);

    if (!parseResult.success) {
      const errors = parseResult.error.flatten().fieldErrors as Record<string, string[]>;
      const fieldErrors = Object.fromEntries(
        Object.entries(errors).map(([key, msgs]) => [key, msgs[0]])
      );

      logger.info("Event creation validation failed", {
        ...logCtx,
        groupId,
        errors: fieldErrors,
      });

      return apiValidationError("Invalid request body", fieldErrors);
    }

    const { title, description, startDate, startTime, location, opId } = parseResult.data;

    // Verify group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true },
    });

    if (!group) {
      logger.warn("Group not found", { ...logCtx, groupId });
      return apiNotFound("Group");
    }

    // Create event in transaction
    const event = await prisma.$transaction(async (tx) => {
      // Create event
      const newEvent = await tx.event.create({
        data: {
          groupId,
          createdBy: user.id,
          title,
          description: description || null,
          startDate: new Date(startDate),
          startTime,
          location: location || null,
        },
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

      // Get group members for notifications
      const groupMembers = await tx.groupMember.findMany({
        where: { groupId },
        select: { userId: true },
      });

      // Create notifications for other members
      const otherMembers = groupMembers.filter((m) => m.userId !== user.id);
      if (otherMembers.length > 0) {
        const notifications = await tx.notification.createMany({
          data: otherMembers.map((member) => ({
            recipientId: member.userId,
            actorId: user.id,
            type: "event_created" as const,
            groupId,
            eventId: newEvent.id,
            message: `created a new event: "${title}"`,
          })),
        });

        // Publish notification events
        if (notifications.count > 0) {
          for (const member of otherMembers) {
            publishNotificationEvent(`${groupId}-${member.userId}`);
          }
        }
      }

      return newEvent;
    });

    // Log success
    logger.info("Event created", {
      ...logCtx,
      groupId,
      eventId: event.id,
      title,
    });

    // Publish group update event
    publishGroupEvent(
      groupId,
      {
        type: "group-updated",
        action: "created",
        eventId: event.id,
        event: serializeEvent(event),
      },
      opId
    );

    return NextResponse.json({ value: serializeEvent(event) }, { status: 201 });
  } catch (err) {
    logger.error("Failed to create event", {
      ...logCtx,
      groupId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    return apiInternalError();
  }
}
