import { NextResponse } from "next/server";

import { publishSharedListEvent } from "@/app/shared-lists/lib/events";
import { addSharedListComment, getSharedListAccessInfo } from "@/app/shared-lists/lib/shared-lists-service";
import { parseRequestJson, getOpId, requireAuth } from "@/app/shared-lists/lib/api-utils";
import { getSharedListDetail } from "@/app/shared-lists/lib/shared-lists-service";
import { getCurrentUser } from "@/app/shared-lists/lib/api-utils";
import { publishNotificationEvent } from "@/app/notifications/lib/events";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

/*
  POST /api/shared-lists/[listId]/comments
  - Authenticated endpoint for posting a top-level comment or a reply.
  - Validates the body and ensures the target list exists and is visible to the user.
  - Creates a notification for the list owner (unless the owner is the actor) and
    publishes an "updated" shared-list event for SSE subscribers.

  GET /api/shared-lists/[listId]/comments
  - Returns the full shared-list detail including nested comments. Visibility is
    resolved using the current user's permissions.
*/
export async function POST(request: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const currentUser = await requireAuth(request);
    const body = await parseRequestJson(request);
    const opId = getOpId(request, body);
    const commentBody = typeof body?.body === "string" ? body.body.trim() : "";
    const parentId = typeof body?.parentId === "string" && body.parentId.trim() ? body.parentId.trim() : undefined;

    if (!commentBody) {
      return NextResponse.json({ error: "Comment body is required." }, { status: 400 });
    }

    // Ensure the list exists and the current user can view it before attempting to write.
    const access = await getSharedListAccessInfo(listId, currentUser);
    if (!access) {
      return NextResponse.json({ error: "Shared list not found." }, { status: 404 });
    }

    try {
      const result = await addSharedListComment(listId, commentBody, currentUser, parentId);
      if ("error" in result) {
        return NextResponse.json(
          { error: result.error === "unauthorized" ? "Unauthorized" : "Shared list not found." },
          { status: result.error === "unauthorized" ? 401 : 404 }
        );
      }

      const updatedList = result.value;

      // Send a notification to the owner if someone else commented (and the actor has a display name).
      if (access.ownerId !== currentUser.id && currentUser.displayName?.trim()) {
        const notification = await prisma.notification.create({
          data: {
            recipientId: access.ownerId,
            actorId: currentUser.id,
            type: "shared_list_comment",
            sharedListId: listId,
            message: `commented on your movie list`,
          },
        });
        publishNotificationEvent({ notificationId: notification.id, recipientId: notification.recipientId });
      }

      // Notify SSE subscribers that the list has been updated (includes opId for reconciliation).
      publishSharedListEvent(listId, "updated", opId, updatedList);
      return NextResponse.json({ value: [updatedList], opId });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        // Map Prisma's "record not found" to a 404 for the client.
        return NextResponse.json({ error: "Comment thread not found." }, { status: 404 });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("Failed to post shared list comment:", error);
    return NextResponse.json({ error: "Failed to post comment." }, { status: 500 });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const currentUser = await getCurrentUser();

    // Use the shared-list detail serializer which returns nested comments.
    const detail = await getSharedListDetail(listId, currentUser);
    if (!detail) {
      return NextResponse.json({ error: "Shared list not found." }, { status: 404 });
    }

    return NextResponse.json({ value: [detail] });
  } catch (error) {
    console.error("Failed to load shared list comments:", error);
    return NextResponse.json({ error: "Failed to load comments." }, { status: 500 });
  }
}