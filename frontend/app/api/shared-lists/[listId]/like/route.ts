import { NextResponse } from "next/server";

import { publishSharedListEvent } from "@/app/shared-lists/lib/events";
import { parseRequestJson, getOpId, requireAuth } from "@/app/shared-lists/lib/api-utils";
import { getSharedListForView, toggleSharedListLike } from "@/app/shared-lists/lib/shared-lists-service";
import { publishNotificationEvent } from "@/lib/group-events";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const currentUser = await requireAuth(_request);
    const actorName = currentUser.displayName?.trim();
    const body = await parseRequestJson(_request);
    const opId = getOpId(_request, body);

    const list = await getSharedListForView(listId, currentUser);
    if (!list) {
      return NextResponse.json({ error: "Shared list not found." }, { status: 404 });
    }

    const result = await toggleSharedListLike(listId, currentUser);
    if ("error" in result) {
      return NextResponse.json({ error: "Shared list not found." }, { status: 404 });
    }

    if (result.isNewLike && list.owner.id !== currentUser.id && actorName) {
      const recentNotification = await prisma.notification.findFirst({
        where: {
          recipientId: list.owner.id,
          actorId: currentUser.id,
          type: "shared_list_like",
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
      });

      if (!recentNotification) {
        const notification = await prisma.notification.create({
          data: {
            recipientId: list.owner.id,
            actorId: currentUser.id,
            type: "shared_list_like",
            sharedListId: listId,
            message: `liked your movie list`,
          },
        });
        publishNotificationEvent(notification.id);
      }
    }

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
