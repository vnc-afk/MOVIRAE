import { NextResponse } from "next/server";

import { deleteSharedList, getCurrentUser } from "@/lib/shared-lists";
import { publishSharedListEvent } from "@/lib/shared-list-events";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const currentUser = await getCurrentUser();
  const result = await deleteSharedList(listId, currentUser);

  if ("error" in result) {
    return NextResponse.json({ error: result.error === "unauthorized" ? "Unauthorized" : "Shared list not found." }, { status: result.error === "unauthorized" ? 401 : 404 });
  }

  publishSharedListEvent(listId, "deleted");
  return NextResponse.json(result);
}