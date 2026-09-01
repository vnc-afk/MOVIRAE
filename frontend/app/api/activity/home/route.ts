import { NextResponse } from "next/server";

import { getHomeActivityFeedSnapshot } from "@/lib/features/activity/feed";

export const runtime = "nodejs";

export async function GET() {
  const value = await getHomeActivityFeedSnapshot();
  return NextResponse.json({ value });
}
