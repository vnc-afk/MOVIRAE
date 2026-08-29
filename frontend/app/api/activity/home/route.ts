import { NextResponse } from "next/server";

import { getHomeActivityFeedSnapshot } from "@/lib/aggregations";

export const runtime = "nodejs";

export async function GET() {
  const value = await getHomeActivityFeedSnapshot();
  return NextResponse.json({ value });
}
