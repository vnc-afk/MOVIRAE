import { NextResponse } from "next/server";

import { addSharedListComment, getCurrentUser, getSharedListForView, fetchSharedLists } from "@/lib/shared-lists";
import { publishSharedListEvent } from "@/lib/shared-list-events";
import { publishNotificationEvent } from "@/lib/group-events";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const currentUser = await getCurrentUser();
    const actorName = currentUser?.displayName?.trim();
    const body = await request.json().catch(() => null);
    const opId = typeof body?.opId === "string" ? body.opId : request.headers.get("x-op-id") ?? undefined;
    const commentBody = typeof body?.body === "string" ? body.body.trim() : "";
    const parentId = typeof body?.parentId === "string" && body.parentId.trim() ? body.parentId.trim() : undefined;

    if (!commentBody) {
      return NextResponse.json({ error: "Comment body is required." }, { status: 400 });
    }

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const list = await getSharedListForView(listId, currentUser);
    if (!list) {
      return NextResponse.json({ error: "Shared list not found." }, { status: 404 });
    }

    if (parentId) {
      const parent = await prisma.sharedListComment.findFirst({ where: { id: parentId, sharedListId: listId } });
      if (!parent) {
        return NextResponse.json({ error: "Comment thread not found." }, { status: 404 });
      }
    }

    await prisma.sharedListComment.create({
      data: {
        sharedListId: listId,
        userId: currentUser.id,
        body: commentBody,
        parentId: parentId || null,
      },
    });

    await prisma.sharedList.update({ where: { id: listId }, data: { comments: { increment: 1 } } });

    // Create notification if commenting on someone else's list
    if (list.owner.id !== currentUser.id && actorName) {
      const notification = await prisma.notification.create({
        data: {
          recipientId: list.owner.id,
          actorId: currentUser.id,
          type: "shared_list_comment",
          sharedListId: listId,
          message: `commented on your movie list`,
        },
      });
      publishNotificationEvent(notification.id);
    }

    const result = await fetchSharedLists(currentUser);
    const updatedList = result.find((list) => list.id === listId);
    publishSharedListEvent(listId, "updated", opId, updatedList);
    return NextResponse.json({ value: result, opId });
  } catch (error) {
    console.error("Failed to post shared list comment:", error);
    return NextResponse.json({ error: "Failed to post comment." }, { status: 500 });
  }
}
