import { NextResponse } from "next/server";

import { publishGroupEvent } from "@/lib/group-events";
import { toggleDiscussionLike } from "@/lib/group-discussions";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ groupId: string; discussionId: string }> }) {
  const { groupId, discussionId } = await params;
  const result = await toggleDiscussionLike(groupId, discussionId);

  if ("error" in result) {
    return NextResponse.json({ error: result.error === "unauthorized" ? "Unauthorized" : "Discussion not found." }, { status: result.error === "unauthorized" ? 401 : 404 });
  }

  publishGroupEvent(groupId, { type: "group-updated" });
  return NextResponse.json(result);
}