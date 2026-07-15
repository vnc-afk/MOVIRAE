import { NextResponse } from "next/server";

import { deleteSharedList } from "@/app/shared-lists/lib/shared-lists-service";
import { publishSharedListEvent } from "@/app/shared-lists/lib/events";
import { requireAuth } from "@/app/shared-lists/lib/api-utils";

export const runtime = "nodejs";

/*
  DELETE /api/shared-lists/[listId]
  - Only the list owner may delete a shared list. `requireAuth` will throw if unauthenticated.
  - `deleteSharedList` returns structured errors that we map to HTTP statuses for the client.
  - On success we publish a "deleted" event so SSE subscribers can remove the list from their UI.
*/
export async function DELETE(_request: Request, { params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;

  try {
    const currentUser = await requireAuth(_request);
    const result = await deleteSharedList(listId, currentUser);

    if ("error" in result) {
      // Map service errors to appropriate HTTP response codes.
      return NextResponse.json(
        { error: result.error === "unauthorized" ? "Unauthorized" : "Shared list not found." },
        { status: result.error === "unauthorized" ? 401 : 404 }
      );
    }

    // Notify connected clients that this list was deleted.
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