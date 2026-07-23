import { NextResponse } from "next/server";

import { publishSharedListEvent } from "@/app/shared-lists/lib/events";
import { parseRequestJson, getOpId, requireAuth } from "@/app/shared-lists/lib/api-utils";
import { getSharedListAccessInfo, toggleSharedListLike } from "@/app/shared-lists/lib/shared-lists-service";
import { publishNotificationEvent } from "@/lib/group-events";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/*
  POST /api/shared-lists/[listId]/like
  - Toggles the authenticated user's like on the list.
  - Creates at-most-one recent notification per actor to avoid flooding owners with repeated likes.
  - Publishes an "updated" event so SSE subscribers can refresh the list summary.
*/
export async function POST(request: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const currentUser = await requireAuth(request);
    const actorName = currentUser.displayName?.trim();
    const body = await parseRequestJson(request);
    const opId = getOpId(request, body);

    // Ensure the list exists and is visible to the current user before toggling like.
    const access = await getSharedListAccessInfo(listId, currentUser);
    if (!access) {
      return NextResponse.json({ error: "Shared list not found." }, { status: 404 });
    }

    const result = await toggleSharedListLike(listId, currentUser);
    if ("error" in result) {
      return NextResponse.json({ error: "Shared list not found." }, { status: 404 });
    }

    // If this is a new like, alert the owner unless they are the actor and avoid duplicate notifications.
    if (result.isNewLike && access.ownerId !== currentUser.id && actorName) {
      const recentNotification = await prisma.notification.findFirst({
        where: {
          recipientId: access.ownerId,
          actorId: currentUser.id,
          type: "shared_list_like",
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
      });

      if (!recentNotification) {
        const notification = await prisma.notification.create({
          data: {
            recipientId: access.ownerId,
            actorId: currentUser.id,
            type: "shared_list_like",
            sharedListId: listId,
            message: `liked your movie list`,
          },
        });
        publishNotificationEvent({ notificationId: notification.id, recipientId: notification.recipientId });      }
    }

    // Notify SSE subscribers of the updated list. `opId` helps reconcile optimistic UI.
    publishSharedListEvent(listId, "updated", opId, result.value);
    return NextResponse.json({ value: [result.value], opId });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("Failed to toggle shared list like:", error);
    return NextResponse.json({ error: "Failed to update like." }, { status: 500 });
  }
}