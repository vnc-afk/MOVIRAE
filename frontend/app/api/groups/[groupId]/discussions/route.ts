import { NextResponse } from "next/server";

import { createDiscussion } from "@/lib/group-discussions";
import { publishGroupEvent } from "@/lib/group-events";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const discussionBody = typeof body?.body === "string" ? body.body.trim() : "";
  const movieId = typeof body?.movieId === "string" ? body.movieId : undefined;

  if (!title || !discussionBody) {
    return NextResponse.json({ error: "Title and body are required." }, { status: 400 });
  }

  const result = await createDiscussion(groupId, { title, body: discussionBody, movieId });

  if ("error" in result) {
    return NextResponse.json({ error: result.error === "unauthorized" ? "Unauthorized" : "Group not found." }, { status: result.error === "unauthorized" ? 401 : 404 });
  }

  publishGroupEvent(groupId, { type: "group-updated" });
  return NextResponse.json(result);
}