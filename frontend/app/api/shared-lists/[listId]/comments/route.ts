import { NextResponse } from "next/server";

import { publishSharedListEvent } from "@/app/shared-lists/lib/events";
import { addSharedListComment, getSharedListForView } from "@/app/shared-lists/lib/shared-lists-service";
import { parseRequestJson, getOpId, requireAuth } from "@/app/shared-lists/lib/api-utils";
import { publishNotificationEvent } from "@/lib/group-events";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

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

    const list = await getSharedListForView(listId, currentUser);
    if (!list) {
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

      if (list.owner.id !== currentUser.id && currentUser.displayName?.trim()) {
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

      publishSharedListEvent(listId, "updated", opId, updatedList);
      return NextResponse.json({ value: [updatedList], opId });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
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
