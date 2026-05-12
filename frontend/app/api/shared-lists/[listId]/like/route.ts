import { NextResponse } from "next/server";

import { getCurrentUser, toggleSharedListLike } from "@/lib/shared-lists";
import { publishSharedListEvent } from "@/lib/shared-list-events";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const currentUser = await getCurrentUser();
    const result = await toggleSharedListLike(listId, currentUser);

    if ("error" in result) {
      return NextResponse.json({ error: result.error === "unauthorized" ? "Unauthorized" : "Shared list not found." }, { status: result.error === "unauthorized" ? 401 : 404 });
    }

    publishSharedListEvent(listId, "updated");
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to toggle shared list like:", error);
    return NextResponse.json({ error: "Failed to update like." }, { status: 500 });
  }
}
