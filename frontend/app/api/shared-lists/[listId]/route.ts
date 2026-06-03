import { NextResponse } from "next/server";

import { deleteSharedList } from "@/app/shared-lists/lib/shared-lists-service";
import { publishSharedListEvent } from "@/app/shared-lists/lib/events";
import { requireAuth } from "@/app/shared-lists/lib/api-utils";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;

  try {
    const currentUser = await requireAuth(_request);
    const result = await deleteSharedList(listId, currentUser);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error === "unauthorized" ? "Unauthorized" : "Shared list not found." },
        { status: result.error === "unauthorized" ? 401 : 404 }
      );
    }

    publishSharedListEvent(listId, "deleted");
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("Failed to delete shared list:", error);
    return NextResponse.json({ error: "Failed to delete shared list." }, { status: 500 });
  }
}