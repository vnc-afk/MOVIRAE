import { NextResponse } from "next/server";

import { getCurrentUser, toggleSharedListLike, getSharedListForView, fetchSharedLists } from "@/lib/shared-lists";
import { publishSharedListEvent } from "@/lib/shared-list-events";
import { publishNotificationEvent } from "@/lib/group-events";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const currentUser = await getCurrentUser();
    const actorName = currentUser?.displayName?.trim();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await _request.json().catch(() => null);
    const opId = typeof body?.opId === "string" ? body.opId : _request.headers.get("x-op-id") ?? undefined;

    const list = await getSharedListForView(listId, currentUser);
    if (!list) {
      return NextResponse.json({ error: "Shared list not found." }, { status: 404 });
    }

    const existingLike = await prisma.sharedListLike.findUnique({
      where: { sharedListId_userId: { sharedListId: listId, userId: currentUser.id } },
    });

    const isNewLike = !existingLike;

    await prisma.$transaction(async (tx) => {
      if (existingLike) {
        await tx.sharedListLike.delete({
          where: { sharedListId_userId: { sharedListId: listId, userId: currentUser.id } },
        });
        await tx.sharedList.update({ where: { id: listId }, data: { likes: { decrement: 1 } } });
        return;
      }

      await tx.sharedListLike.create({
        data: { sharedListId: listId, userId: currentUser.id },
      });
      await tx.sharedList.update({ where: { id: listId }, data: { likes: { increment: 1 } } });
    });

    // Create notification if liking someone else's list
    if (isNewLike && list.owner.id !== currentUser.id && actorName) {
      // Check for duplicate notification within 5 minutes
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

    const result = await fetchSharedLists(currentUser);
    const updatedList = result.find((list) => list.id === listId);
    publishSharedListEvent(listId, "updated", opId, updatedList);
    return NextResponse.json({ value: result, opId });
  } catch (error) {
    console.error("Failed to toggle shared list like:", error);
    return NextResponse.json({ error: "Failed to update like." }, { status: 500 });
  }
}
