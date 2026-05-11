import { NextResponse } from "next/server";

import { addDiscussionReply } from "@/lib/group-discussions";
import { publishGroupEvent } from "@/lib/group-events";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ groupId: string; discussionId: string }> }) {
  const { groupId, discussionId } = await params;
  const body = await request.json().catch(() => null);
  const replyBody = typeof body?.body === "string" ? body.body.trim() : "";

  if (!replyBody) {
    return NextResponse.json({ error: "Reply body is required." }, { status: 400 });
  }

  const result = await addDiscussionReply(groupId, discussionId, replyBody);

  if ("error" in result) {
    return NextResponse.json({ error: result.error === "unauthorized" ? "Unauthorized" : "Discussion not found." }, { status: result.error === "unauthorized" ? 401 : 404 });
  }

  publishGroupEvent(groupId, { type: "group-updated" });
  return NextResponse.json(result);
}