import { NextResponse } from "next/server";

import { createSharedList, fetchSharedLists } from "@/lib/shared-lists";
import { publishSharedListEvent } from "@/app/shared-lists/lib/events";
import { getCurrentUser, getOpId, parseRequestJson, requireAuth } from "@/app/shared-lists/lib/api-utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth(request);
    const body = await parseRequestJson(request);
    const opId = getOpId(request, body);

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const visibility = body?.visibility === "private" || body?.visibility === "group" ? body.visibility : "public";
    const groupId = typeof body?.groupId === "string" && body.groupId.trim() ? body.groupId.trim() : undefined;

    if (!name) {
      return NextResponse.json({ error: "List name is required." }, { status: 400 });
    }

    const result = await createSharedList({ name, description, visibility, groupId }, currentUser);
    if ("error" in result) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const createdList = Array.isArray(result.value) && result.value.length > 0 ? result.value[0] : undefined;
    const createdListId = createdList?.id ?? "new";
    publishSharedListEvent(createdListId, "created", opId, createdList);
    return NextResponse.json({ ...result, opId });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("Failed to create shared list:", error);
    return NextResponse.json({ error: "Failed to create shared list." }, { status: 500 });
  }
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    return NextResponse.json({
      value: await fetchSharedLists(currentUser),
      currentUser: currentUser
        ? {
            id: currentUser.id ?? undefined,
          }
        : null,
    });
  } catch (error) {
    console.error("Failed to load shared lists:", error);
    return NextResponse.json({ error: "Failed to load shared lists." }, { status: 500 });
  }
}
