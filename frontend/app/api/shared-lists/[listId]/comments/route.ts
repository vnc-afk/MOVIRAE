import { NextResponse } from "next/server";

import { addSharedListComment, getCurrentUser } from "@/lib/shared-lists";
import { publishSharedListEvent } from "@/lib/shared-list-events";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const currentUser = await getCurrentUser();
    const body = await request.json().catch(() => null);
    const commentBody = typeof body?.body === "string" ? body.body.trim() : "";
    const parentId = typeof body?.parentId === "string" && body.parentId.trim() ? body.parentId.trim() : undefined;

    if (!commentBody) {
      return NextResponse.json({ error: "Comment body is required." }, { status: 400 });
    }

    const result = await addSharedListComment(listId, commentBody, currentUser, parentId);

    if ("error" in result) {
      const errorMessage =
        result.error === "unauthorized"
          ? "Unauthorized"
          : result.error === "parent-not-found"
          ? "Comment thread not found."
          : "Shared list not found.";
      const status =
        result.error === "unauthorized"
          ? 401
          : result.error === "parent-not-found"
          ? 404
          : 404;

      return NextResponse.json({ error: errorMessage }, { status });
    }

    publishSharedListEvent(listId, "updated");
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to post shared list comment:", error);
    return NextResponse.json({ error: "Failed to post comment." }, { status: 500 });
  }
}
