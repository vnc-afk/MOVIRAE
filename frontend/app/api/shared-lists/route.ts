import { NextResponse } from "next/server";

import { createSharedList, fetchSharedLists } from "@/app/shared-lists/lib/service";
import { publishSharedListEvent } from "@/app/shared-lists/lib/events";
import { getCurrentUser, getOpId, parseRequestJson, requireAuth } from "@/app/shared-lists/lib/api-utils";

/*
  Top-level shared-lists API routes:
  - POST /api/shared-lists: create a new shared list (requires auth).
    * Validates payload, attaches an `opId` for optimistic reconciliation and SSE matching.
    * Publishes an in-process event after creation so connected clients can update via SSE.
  - GET /api/shared-lists: list/paginate shared lists visible to the current user.
*/
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    // Ensure the request is authenticated and get the current user record.
    const currentUser = await requireAuth(request);
    const body = await parseRequestJson(request);
    const opId = getOpId(request, body);

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const visibility = body?.visibility === "private" || body?.visibility === "group" ? body.visibility : "public";
    const groupId = typeof body?.groupId === "string" && body.groupId.trim() ? body.groupId.trim() : undefined;

    if (!name) {
      // Return a clear 400 response that UI code can show to users.
      return NextResponse.json({ error: "List name is required." }, { status: 400 });
    }

    // Persist the shared list and refresh the paginated list payload for the client.
    const result = await createSharedList({ name, description, visibility, groupId }, currentUser);
    if ("error" in result) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const createdList =
      result.value.lists.length > 0
        ? result.value.lists.find((l) => l.owner.id === currentUser.id && l.name === name) ?? result.value.lists[0]
        : undefined;
    const createdListId = createdList?.id ?? "new";
    // Publish an in-process event to notify SSE subscribers. The `opId` allows
    // clients that performed optimistic updates to reconcile temp items with server IDs.
    publishSharedListEvent(createdListId, "created", opId, createdList);

    return NextResponse.json({
      value: result.value.lists,
      hasMore: result.value.hasMore,
      nextPage: result.value.nextPage,
      opId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("Failed to create shared list:", error);
    return NextResponse.json({ error: "Failed to create shared list." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page")) || 1;
    const pageSize = Number(url.searchParams.get("pageSize")) || undefined;

    const result = await fetchSharedLists(currentUser, { page, pageSize });

    return NextResponse.json({
      value: result.lists,
      hasMore: result.hasMore,
      nextPage: result.nextPage,
      currentUser: currentUser
        ? { id: currentUser.id ?? undefined, email: currentUser.email ?? undefined }
        : null,
    });
  } catch (error) {
    console.error("Failed to load shared lists:", error);
    return NextResponse.json({ error: "Failed to load shared lists." }, { status: 500 });
  }
}